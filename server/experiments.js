const config        = require('../config');
const urljoin       = require('url-join');
const studies_comp  = require('./studies');
const join          = require('path').join;
const users_comp    = require('./users');
const utils         = require('./utils');
const data_server   = require('./data_server/controllers/controller');
const connection    = Promise.resolve(require('mongoose').connection);
const fs            = require('fs-extra');
const path          = require('path');

const {ObjectId}    = require('mongodb');

const {has_read_permission, has_read_data_permission, has_write_permission} = studies_comp;

// get data for playing a file without creating an experiment
// creates sham info for the player
function get_play_url (user_id, study_id, file_id) {
    return has_read_permission(user_id, study_id)
        .then(({study_data})  => {
            const url = urljoin(config.relative_path,'users',study_data.folder_name,file_id);
            const base_url = urljoin(config.relative_path,'users',study_data.folder_name, '/');
            const path = join(config.user_folder,study_data.folder_name,file_id);

            // set sham experiment data
            return {
                exp_id: -1,
                descriptive_id: '',
                session_id:-1,
                type: study_data.type,
                url,
                path,
                base_url
            };
        });
}

function get_experiment_url (req) {
    return connection.then(function (db) {
        const counters = db.collection('counters');
        const studies = db.collection('studies');
        return studies.findOne({experiments: { $elemMatch: {id: req.params.exp_id} }})
            .then(function(exp_data){
                if(!exp_data)
                    return Promise.reject({status:400, message:'Error: Experiment doesn\'t exist'});
                return users_comp.user_info(exp_data.users[0].id)
                    .then(function(){
                        const last_version = exp_data.versions ? exp_data.versions[exp_data.versions.length-1] : '';
                        if(last_version.id !== req.params.version_id)
                            return Promise.reject({status:400, message:'Error: Wrong version'});

                        const exp       = exp_data.experiments.filter(exp => exp.id===req.params.exp_id);
                        const url       = urljoin(config.relative_path, 'users', exp_data.folder_name, exp[0].file_id);
                        const base_url  = urljoin(config.relative_path, 'users', exp_data.folder_name,'/');
                        const path      = join(config.user_folder,  exp_data.folder_name,exp[0].file_id);

                        return counters.findOneAndUpdate({_id:'session_id'},
                            {'$inc': {'seq': 1}},
                            {upsert: true, new: true, returnOriginal: false})
                            .then(function(counter_data){
                                const session_id = counter_data.value.seq;
                                return {
                                    version_data: last_version,
                                    exp_id:req.params.exp_id,
                                    descriptive_id: exp[0].descriptive_id,
                                    session_id,
                                    type: exp_data.type,
                                    url,
                                    path,
                                    base_url
                                };
                            });
                    });
            });
    });
}

function get_experiments(user_id, study_id) {
    return has_read_permission(user_id, study_id)
        .then(({study_data})=>study_data);
}

// This function are used for update the requests that sent by *all* the users.
// First, it will remove all the old (>7 days) requests from both DB and FS.
// Later, it will put the new request with the current timestamp into the DB.
function add_data_request(user_id, study_id, exp_id, file_format, file_split, start_date, end_date, version_id) {
    return connection.then(function (db) {

        const week_ms = 1000*60*60*24*7;
        const data_requests = db.collection('data_requests');
        return data_requests.find({creation_date: {$lt: Date.now()-week_ms}})
        .toArray()
        .then(requests => { return Promise.all(requests.map(request => {
            if (!request.path)
                return;
            const delPath = path.join(config.base_folder, config.dataFolder,  request.path);
            fs.remove(delPath);
        }));
        })
        .then(() => data_requests.deleteMany({creation_date: {$lt: Date.now()-week_ms}}))
        .then(() => data_requests.deleteMany({status:'No data'}))
        .then(() => data_requests.insertOne({
            user_id,
            study_id,
            exp_id,
            file_format,
            file_split,
            start_date,
            end_date,
            version_id,
            status: 'in progress',
            creation_date: Date.now()
        }));
    });
}


function update_data_request(request_id, path2file) {
    return connection.then(function (db) {
        return fs.stat(path.join(config.base_folder, config.dataFolder, path2file)).then(file_data=>{
            const data_requests = db.collection('data_requests');
            return data_requests.updateOne({_id: request_id},
                {$set:{
                    status: 'Ready',
                    path: path2file,
                    size: file_data.size}}
            );
        });
    });
}

function cancel_data_request(request_id) {
    return connection.then(function (db) {
        const data_requests = db.collection('data_requests');
        return data_requests.updateOne({_id: request_id},
            {$set:{
                status: 'No data',
                path: '',
                size: ''}}
        );
    });
}


function get_data_requests(user_id, study_id) {
    return connection.then(function (db) {
        const two_days_ms = 1000*60*60*24*2;

        const data_requests = db.collection('data_requests');
        return data_requests.find({user_id, study_id, creation_date: {$gt: Date.now()-two_days_ms}})
            .toArray();
    });
}



function delete_data_request(user_id, study_id, request_id) {
    return connection.then(function (db) {
        const data_requests = db.collection('data_requests');
        return data_requests.findOne({_id: ObjectId(request_id)})
            .then(request => {
                const delPath = path.join(config.base_folder, config.dataFolder,  request.path);
                fs.remove(delPath);
                data_requests.deleteOne({_id: ObjectId(request_id)});
            });
    });
}

function get_stat(user_id, study_id, exp_id, version_id, start_date, end_date, date_size) {
    const additional_columns = [];

    return has_read_data_permission(user_id, study_id)
        .then(()=> data_server.getStatistics(exp_id, version_id, start_date, end_date, date_size, additional_columns))
        .catch(err=>Promise.reject({status:err.status || 500, message: err.message}));
}



function get_data(user_id, study_id, exp_id, file_format, file_split, start_date, end_date, version_id) {

    return has_read_data_permission(user_id, study_id)
        .then(()=>
            add_data_request(user_id, study_id, exp_id, file_format, file_split, start_date, end_date, version_id)
            .then((record)=>{

                const request_id=record.ops[0]._id;
                data_server.getData(exp_id, file_format, file_split, start_date, end_date, version_id)
                .then(path2file=>update_data_request(request_id, path2file))
                 .catch(()=>cancel_data_request(request_id));
                return {request_id};
            }))
        .catch(err=>Promise.reject({status:err.status || 500, message: err.message}));
}


function insert_new_experiment(user_id, study_id, file_id, descriptive_id) {
    if (!descriptive_id)
        return Promise.reject({status:402, message: 'ERROR: descriptive id is missing!'});

    return has_write_permission(user_id, study_id)
        .then(function() {
            return connection.then(function (db) {
                const studies = db.collection('studies');
                return studies.findOneAndUpdate({_id: study_id, experiments: {$elemMatch:{file_id:file_id, descriptive_id: descriptive_id}}},
                    {$unset:{'experiments.$.inactive': false}},
                    {upsert: false, new: true, returnOriginal: true})
                    .then(function(data){
                        const id = utils.sha1(study_id + file_id + descriptive_id + Math.random());
                        if(!data.lastErrorObject || !data.lastErrorObject.n)
                            return studies.updateOne({_id: study_id}, {
                                $push: {
                                    experiments: {
                                        id: id,
                                        file_id: file_id, descriptive_id: descriptive_id
                                    }
                                }
                            })
                            .then(function (user_result) {
                                if (!user_result)
                                    return Promise.reject({status:500, message: 'ERROR: internal error!'});
                                return ({id: id,
                                    file_id: file_id,
                                    descriptive_id: descriptive_id
                                });
                            });
                        const exp_data = data.value.experiments.find(exp=>exp.file_id===file_id && descriptive_id===descriptive_id);
                        return ({
                            id: exp_data.id,
                            file_id: file_id,
                            descriptive_id: descriptive_id
                        });


                    });
            });
        });
}

function delete_experiment(user_id, study_id, file_id) {
    return has_write_permission(user_id, study_id)
        .then(function() {
            return connection.then(function (db) {
                const studies = db.collection('studies');
                return studies.findOne({_id: study_id, experiments:{$elemMatch:{file_id:file_id}}})
                    .then(function(study_data){
                        if (!study_data)
                            return;
                        const exps = study_data.experiments.map(exp=>exp.file_id!==file_id ? exp : {id:exp.id, file_id:exp.file_id, descriptive_id: exp.descriptive_id, inactive:true});
                        return studies.updateOne({_id: study_id},
                            {$set:{experiments: exps}}
                        );
                    });
            });
        });
}

function update_descriptive_id(user_id, study_id, file_id, descriptive_id) {
    return has_write_permission(user_id, study_id)
        .then(function() {
            return connection.then(function (db) {
                const studies = db.collection('studies');
                return studies.updateOne(
                    {_id: study_id, experiments:{$elemMatch:{file_id, inactive:{$ne:true}}}},
                    {$set:{'experiments.$.descriptive_id': descriptive_id}}
                );
            });
        });
}

function update_file_id(user_id, study_id, file_id, new_file_id) {
    return has_write_permission(user_id, study_id)
        .then(function() {
            return connection.then(function (db) {
                const studies = db.collection('studies');
                return studies.updateOne(
                    {_id: study_id, experiments:{$elemMatch:{file_id:file_id}}},
                    {$set:{'experiments.$.file_id':new_file_id}}
                );
            });
        });
}

// function is_descriptive_id_exist(user_id, study_id, descriptive_id) {
//     return has_read_permission(user_id, study_id)
//         .then(function() {
//             return connection.then(function (db) {
//                 const studies = db.collection('studies');
//                 return studies.findOne({_id: study_id, experiments: { $elemMatch: { descriptive_id: descriptive_id } }})
//                 .then(study_data => !!study_data);
//             });
//         });
// }

module.exports = {get_play_url, get_experiment_url, get_experiments, get_data, update_descriptive_id, update_file_id, delete_experiment, insert_new_experiment, get_data_requests, delete_data_request, get_stat};
