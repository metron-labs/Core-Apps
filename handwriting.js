var Client = require('node-rest-client').Client;
var client = new Client();
var writeFile = require('write');
var gm = require('gm');
var Ftp = require('ftp');
var fs = require('fs');

var emitter = require('../core-integration-server-v2/javascripts/emitter');
var apiToken, tokenSecret, siteName, handwritingId, width, height, text;
var errMsg = '"Connnection time out" error in Handwriting';


function run(node) {
	try {
		var nodeType =  node.connector.type.toLowerCase();
		var type = node.option.toLowerCase();
		var reqObj = node.reqData;
		if(nodeType == 'trigger') {
			getCoreCacheData(node);
		} else{
			renderHandwriting(type, node);
		}
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function getCoreCacheData(node) {
	try {
		actionName = node.connection.actionName.toLowerCase();
		emitter.emit("get-from-core", node, function(data) {
			try {
				var resArr = [];
				var resObj;
				for(var i = 0; i < data.length; i++) {
					resObj = data[i].dataObj;
					if(resObj.hasOwnProperty('shippingAddress')) {
						resObj.type = 'order';
					} else {
						resObj.type = 'customer';
					}
					if(i == data.length-1) {
						resObj.isLast = true;
						if(actionName == 'slack') {
							resObj.slackFlag = true;
						}
					}
					resArr[i] = resObj;
					if(i == data.length-1) {
						node.resData = resArr;
						emitter.emit('success', node, '');
					}
				}				
			} catch(e) {
				emitter.emit('error', e.message, e.stack, "", node);
			}
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function b64EncodeUnicode(str) {
	return new Buffer(str).toString('base64');
}

function convertImage(data, res, node) {
	try {
		var reqObj = node.reqData;
		var imgData = "data:" + res.headers["content-type"] + ";base64," + new Buffer(data).toString('base64');
		var ext = imgData.split(';')[0].match(/jpeg|png|gif/)[0];
		var buf = new Buffer(data);
		var randomText = 'result_';
		var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
		for( var i=0; i < 10; i++ ) {
			randomText += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		var file = writeFile.stream('./images/handwriting/' + reqObj.id + '.' + ext);
		file.write(buf);
		file.end();
		file.on('finish' , function() {
			gm('./images/handwriting/ post.png')
			.composite('./images/handwriting/' + reqObj.id + '.' + ext)
			.geometry('+320+550')
			.write('./images/handwriting/' + randomText + '.' + ext, function (err) {
				if (err) {
					var errMsg = 'Error while rendering file by Handwriting'; console.log(err);
					emitter.emit('error', errMsg, '', '', node);
				} else { 					
					reqObj.id = reqObj.id.toString();
					var server = new Ftp();
					var options = {
						host: 'neemtecsolutions.com',
						port : 21,
						user : 'corehq',
						password : 'C0r3h916#'
					};
					server.connect(options);
					server.on('ready', function() {
						server.put('./images/handwriting/' + randomText + '.' + ext, randomText + '.' + ext, function(err) {
							if (err) {
								var errMsg = 'Error while uploading file created by Handwriting'; 
								emitter.emit('error', errMsg, '', '', node);
							} else {
								reqObj.fileUrl = 'http://neemtecsolutions.com/corehq/' + randomText + '.' + ext;
								node.dataObj = reqObj;
								fs.unlink('./images/handwriting/' + reqObj.id + '.' + ext);
								fs.unlink('./images/handwriting/' + randomText + '.' + ext);
								var message = 'Successfully rendered your file in Handwriting';
								emitter.emit('save-to-core', node, message);
							}
							server.end();
						});
					});
				}
			});
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function renderHandwriting(type, node) {
	try {
		var reqObj = node.reqData;
		var url = "https://api.handwriting.io/render/png?handwriting_id=" + handwritingId
		+ "&text=" + text + "&width=" + width + "&height=" + height 
		+ "&handwriting_size=120px&handwriting_color=" + encodeURIComponent("#FFFFFF");
		var args = {
			headers : {
				Authorization : "Basic " + b64EncodeUnicode(apiToken + ":" + tokenSecret),
				Accept : "application/json",
				"Content-Type" : "application/json"
			}
		};
		client.get(url, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				var msg;
				if(status == 2){
					convertImage(data, res, node);
				} else{
					if(data.hasOwnProperty('message')) {
						errMsg = data.message;
					}
					emitter.emit('error', errMsg, args.data, url, node);
				}
			} catch(e) {
				emitter.emit('error', e.message, e.stack, url, node);
			}
		}).on('error', function(err) {
			emitter.emit('error', errMsg, args.data, url, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function testApp(callback) {
	try {
		var url = "https://api.handwriting.io/handwritings";
		var args = {
			headers : {
				Authorization : "Basic " + b64EncodeUnicode(apiToken + ":" + tokenSecret),
				Accept : "application/json"
			}
		};
		client.get(url, args, function(data, res){
			try {
				var statusCode = parseInt(res.statusCode/100);
				if(statusCode == 2){
					result = {
						status :'success',
						response: data
					};
				} else{
					result = {
						status :'error',
						response : data
					};  
				}
				callback(result);
			} catch(e) {
				callback({status:"error", response:e.stack});
			}
		}).on('error', function(err) {
			callback({status:"error", response:err});
		});
	} catch(e) {
		callback({status:"error", response:e.stack});
	}
}

function test(request, callback) {
	try {
		var credentials = request.credentials;
		apiToken = credentials.apiToken;
		tokenSecret = credentials.tokenSecret;
		testApp(callback);
	} catch(e) {
		callback({status:"error", response:e.stack});
	}
}

function init(node) {
	try {
		var credentials = node.credentials;
		apiToken = credentials.apiToken;
		tokenSecret = credentials.tokenSecret;
		handwritingId = credentials.handwritingId;
		width = credentials.textWidth;
		height = credentials.textHeight;
		text = credentials.textMessage;
		run(node);
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

var Handwriting = {
	init : init,
	test : test
};

module.exports = Handwriting;