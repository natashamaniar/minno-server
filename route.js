var express     = require('express');
var session     = require('express-session');
var connect     = require('./connect');
var studies     = require('./studies');
var tags        = require('./tags');
var config      = require('./config');
var experiments = require('./experiments');
var dateFormat  = require('dateformat');
const fs        = require('fs-extra');

var users       = require('./users');

var files       = require('./files');
var sender      = require('./sender');

var bodyParser = require('body-parser');
var app = express();
var cors = require('cors');
var day = dateFormat(new Date(), "yyyy-mm-dd");
if (!fs.existsSync(config.logs_folder))
    fs.mkdirSync(config.logs_folder);
SimpleNodeLogger = require('simple-node-logger'),
    opts = {
        logFilePath:`${config.logs_folder}/${day}.log`,
        timestampFormat:'YYYY-MM-DD HH:mm:ss.SSS'
    },
    log = SimpleNodeLogger.createSimpleLogger( opts );


if (!fs.existsSync(config.static_path)) throw new Error(`Config: static_path folder does not exist "${config.static_path}"`);
app.use('/static', express.static(config.static_path));

app.use('/users', express.static(config.user_folder));
app.use('/minno-manager', express.static(config['minno-manager']));
app.use('/minno-time', express.static(config['minno-time']));


app.use(cors({
    credentials: true, origin: true,
    "methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
    "preflightContinue": false,
    'Access-Control-Allow-Credentials': true,
    "optionsSuccessStatus": 204

}));

app.use(session({secret: 'ssshhhhh',
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.set('views', __dirname + '/views');

app.engine('html', require('ejs').renderFile);

// app.use(bodyParser.json());
//
// app.use(bodyParser.urlencoded({extended: true}));

app.use(bodyParser.urlencoded({limit: '50mb',extended: true}));
app.use(bodyParser.json({limit: '50mb'}));



var sess;


/*****         data            *****/
var mongoose = require('mongoose'),
    Data = require('./data_server/models/dataSchema');

mongoose.Promise = global.Promise;
mongoose.connect(config.mongo_url);

var data_controller = require('./data_server/controllers/controller');
app.route(config.relative_path+'/data')
    .put(data_controller.insertData);
app.route(config.relative_path+'/data')
    .get(data_controller.getData);
/********************************************/

app.get(config.relative_path+'/',function(req,res){
    res.redirect('/static');
});

app.get(config.relative_path+'/is_loggedin',function(req,res){
    sess = req.session;
    if (sess.user)
        return res.end(JSON.stringify({
            isloggedin:true,
            role:sess.user.role
        }));
    else
        return res.end(JSON.stringify({
            isloggedin: false, timeoutInSeconds: 0
        }));
});


app.post(config.relative_path+'/connect',function(req, res){
        sess = req.session;
        connect.check(req.body.username, req.body.password, res, function(user_data){
            sess.user = user_data;
            res.end(JSON.stringify(user_data._id));
        });
    });

app.route(config.relative_path+'/download').get(
    function(req, res){
        sess = req.session;
        if(!sess.user){
            res.statusCode = 403;
            return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
        }
        console.log(req.query.path);
        files.download_zip(req.query.path, res);
    }

);

app.route(config.relative_path+'/files/:study_id').get(
    function(req, res){
        sess = req.session;
        if(!sess.user){
            res.statusCode = 403;
            return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
        }
        files.get_study_files(sess.user.id, parseInt(req.params.study_id), res);
    })
    .delete(
        function(req, res){
            sess = req.session;
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            files.delete_files(sess.user.id, parseInt(req.params.study_id), req.body.files, res);
        })
    .post(
        function(req, res){
            sess = req.session;
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            files.download_files(sess.user.id, parseInt(req.params.study_id), req.body.files, res);
        });

app.route(config.relative_path+'/files/:study_id/upload/')
    .post(
        function(req, res){
            files.upload(sess.user.id, parseInt(req.params.study_id), req, res);
        });


app.route(config.relative_path+'/files/:study_id/upload/:folder_id')
    .post(
        function(req, res){
            files.upload(sess.user.id, parseInt(req.params.study_id), req, res);
        });

app.route(config.relative_path+'/files/:study_id/file/')

    .post(
        function(req, res){
            sess = req.session;
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            if(req.body.isDir)
                return files.create_folder(sess.user.id, parseInt(req.params.study_id), req.body.name, res);

            files.update_file(sess.user.id, parseInt(req.params.study_id), req.body.name, req.body.content, res);
        });

app.route(config.relative_path+'/files/:study_id/file/:file_id')
    .get(
        function(req, res){
            sess = req.session;
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            files.get_file_content(sess.user.id, parseInt(req.params.study_id), req.params.file_id, res);
        })
    .put(
        function(req, res){
            sess = req.session;
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }

            files.update_file(sess.user.id, parseInt(req.params.study_id), req.params.file_id, req.body.content, res);
        });

app.route(config.relative_path+'/files/:study_id/file/:file_id/move')
    .put(
        function(req, res){
            sess = req.session;
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            files.rename_file(sess.user.id, parseInt(req.params.study_id), req.params.file_id, req.body.path, res);
        });

app.route(config.relative_path+'/files/:study_id/file/:file_id/copy')
    .put(
        function(req, res){
            sess = req.session;
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            files.copy_file(sess.user.id, parseInt(req.params.study_id), req.params.file_id, parseInt(req.body.new_study_id), res);

        });

app.route(config.relative_path+'/studies/:study_id/experiments')
    .get(
        function(req, res){
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            experiments.get_experiments(sess.user.id, parseInt(req.params.study_id), res);
        })
    .post(
        function(req, res){
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            experiments.get_data(sess.user.id, parseInt(req.params.study_id), req.body.exp_id,
                                    req.body.file_format, req.body.start_date, req.body.end_date, res);
        });

app.route(config.relative_path+'/files/:study_id/file/:file_id/experiment')
    .post(
        function(req, res){
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            experiments.insert_new_experiment(sess.user.id, parseInt(req.params.study_id), req.params.file_id, req.body.descriptive_id, res);
        })

    .delete(
        function(req, res){
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }

            experiments.delete_experiment(sess.user.id, parseInt(req.params.study_id), req.params.file_id, res);
        })
    .put(
        function(req, res){
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            experiments.update_descriptive_id(sess.user.id, parseInt(req.params.study_id), req.params.file_id, req.body.descriptive_id, res);
        });


app.route(config.relative_path+'/studies/:study_id/copy')
    .put(
        function(req, res){
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            studies.duplicate_study(sess.user.id, parseInt(req.params.study_id), req.body.study_name, res);
        });


app.route(config.relative_path+'/studies/:study_id/tags')
    .get(
        function(req, res){
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            tags.get_study_tags(sess.user.id, parseInt(req.params.study_id), res);
        })
    .put(
        function(req, res){
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            tags.update_study_tags(sess.user.id, parseInt(req.params.study_id), req.body.tags, res);
        });


app.route(config.relative_path+'/studies')
    .get(
        function(req, res){
            sess = req.session;
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            studies.get_studies(sess.user.id, res);
        })
    .post(
        function(req, res){
            sess = req.session;
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            studies.create_new_study(sess.user.id, req.body.study_name, res)

        });


app.route(config.relative_path+'/studies/:study_id')
    .delete(
        function(req, res){
            sess = req.session;
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            studies.delete_study(sess.user.id, parseInt(req.params.study_id), res)})
    .put(
        function(req, res){

            sess = req.session;
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            studies.rename_study(sess.user.id, parseInt(req.params.study_id), req.body.study_name, res);
        });



app.route(config.relative_path+'/tags')
    .get(
        function(req, res){
            sess = req.session;
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            tags.get_tags(sess.user.id, res);
        })
    .post(
        function(req, res){
            sess = req.session;
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            tags.insert_new_tag(sess.user.id, req.body.tag_text, req.body.tag_color, res);
        })
   ;


app.route(config.relative_path+'/tags/:tag_id')
    .delete(
        function(req, res){
            sess = req.session;
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            tags.delete_tag(sess.user.id, req.params.tag_id, res);
        })
    .put(function(req, res){
        tags.update_tag(sess.user.id, {id: req.params.tag_id, text: req.body.tag_text, color:req.body.tag_color}, res);
    });

app.route(config.relative_path+'/change_email')
    .get(
        function(req, res){
            sess = req.session;
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            users.get_email(sess.user.id, res);

        })
    .post(
        function(req, res){
            sess = req.session;
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            users.set_email(sess.user.id, req.body.email, res);

        });


app.route(config.relative_path+'/add_user')
    .post(
        function(req, res){
            sess = req.session;
            if(!sess.user || sess.user.role!='su') {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            users.insert_new_user(req, res);

        });

app.route(config.relative_path+'/change_password')
    .post(
        function(req, res){
            sess = req.session;
            if(!sess.user) {
                res.statusCode = 403;
                return res.send(JSON.stringify({message: 'ERROR: Permission denied!'}));
            }
            users.set_password(sess.user.id, req.body.password, req.body.confirm, res);

        });


app.route(config.relative_path+'/activation/:code')
    .get(
        function(req, res){
            sess = req.session;
            if(sess.user) {
                res.redirect('/');
                return;
            }
            users.check_activation_code(req.params.code, res);
        })
    .post(
        function(req, res){
            users.set_user_by_activation_code(req.params.code, req.body.password, req.body.confirm, res);

        });

app.post(config.relative_path+'/logout',function(req, res){
    req.session.destroy(function(err) {
        if(err) {
            console.log(err);
        } else {
            res.redirect('/');
        }
    });

});

app.get(config.relative_path+'/launch/:exp_id',function(req, res){
    app.set('view engine', 'ejs');
    return experiments.get_experiment_url(req).then(function(exp_data) {

        res.render('launch', {descriptiveId: exp_data.descriptive_id, sessionId:exp_data.session_id, url: exp_data.url, studyId:exp_data.exp_id});
    });
});

app.get(config.relative_path+'/play/:study_id/:file_id',function(req, res){
    var sess = req.session;
    if(!sess.user) {
        return;
    }
    app.set('view engine', 'ejs');
        return experiments.get_play_url(sess.user.id, req.params.study_id, req.params.file_id).then(function(exp_data) {
            res.render('launch', {sessionId:exp_data.session_id, url: exp_data.url, studyId:exp_data.exp_id});
    });
});

app.get(config.relative_path+'/users',function(req, res){
    var sess = req.session;

    if(!sess.user || sess.user.role!='su') {
        return;
    }
    return users.get_users(res);

});

app.listen(config.port,function(){
    console.log("App Started on PORT "+config.port);
});
