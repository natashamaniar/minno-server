const config      = require('../config');
const fs          = require('fs-extra');
const path        = require('path');
const dataFolder = path.join(config.base_folder,config.dataFolder);


[
    {param: 'server_type', message:`server_type: 'http', 'https', or 'greenlock'`},
    {param: 'admin_default_pass', message:`The default password for te admin. For example 'admin123'`},
    {param: 'zip_folder', message: `The folder for saving temporary files. Relative to your "base_url". For example 'tmp'`},
    {param: 'dataFolder', message: `The folder for saving data files. Relative to your "base_url". For example 'data_files'`},
    {param: 'minnojsUrl', message: `The url for loading MinnoJS. For example: '//cdn.jsdelivr.net/gh/minnojs/minno-quest@0.2/dist/'`},
]
    .forEach(function({param, message}){
        if (param in config) return;
        console.log('\x1b[36m%s\x1b[0m',`
            ====================================
            MinnoJS
            Config: missing parameter "${param}".
            ${message}
            ====================================
        `);
        throw new Error(`Config: missing parameter "${param}".`);
    });

if (config.relative_path[0] !== '/') throw new Error('Config: relative_path must begin with "/"');

[config.user_folder, dataFolder, config.logs_folder].forEach( path => fs.ensureDirSync(path) );
