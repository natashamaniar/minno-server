'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var dataRequestSchema = new Schema({
  studyId: {
    type: String,
    required: [true,'A studyId is required']
  },
  requestId: {
    type: String,
    required: [true,'A requestId is required']
  },
  status: {
    type: String,
    default: 'running'
  },
  url: {
    type: String,
  },
  createdDate: {
    type: Date,
    default: Date.now
  },
  details: {
    type: Schema.Types.Mixed
  }
});


module.exports = mongoose.model('DataRequest', dataRequestSchema);