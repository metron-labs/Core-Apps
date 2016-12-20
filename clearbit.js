var Client = require('node-rest-client').Client;
var client = new Client();

var emitter = require('../core-integration-server-v2/javascripts/emitter');

var apiKey;
var errMsg = 'Something went wrong on the request';

function run(node) {
	try {	
		var type = node.option.toLowerCase();
		var obj = node.requestData;
		var url = "https://person-stream.clearbit.com/v2/combined/find?email=" + obj.email;
		var args = {
			headers:{Authorization : "Bearer " + apiKey, Accept : "application/json" }
		};
		client.get(url,args,function(data,res) {
			try {
				var status = parseInt(res.statusCode/100);
				if(status == 2) {
					var msg = 'Person with email id ' + obj.email + ' had found in Clearbit';
					post(data, node, msg);
				} else {
					errMsg = data;
					emitter.emit('error', errMsg, "", url, node);
				}
			} catch(e) {
				emitter.emit('error', e.message, "", url, node);
			}
		}).on('error',function(err) {
			console.log(errMsg, err.request.options);
			emitter.emit("error", errMsg);
		});	
	} catch(e) {
		emitter.emit('error', e.message, "", "", node);
	}
}

function b64EncodeUnicode(str) {
    return new Buffer(str).toString('base64');
}

function post(response, node, message) {
	try {
	    node.resData = response;
	   	emitter.emit("success", node, message);
	} catch(e) {
		emitter.emit('error', e.message, '','',node);
	}
}

function testApp(callback) {
	try {
		var url = "https://company-stream.clearbit.com/v2/companies/find?domain=neemtecsolutions.com";
	    var args = {      
	        headers : {
	            "Authorization" : "Bearer " + apiKey,
	            "Accept" : "application/json",
	        }
	    };
	    var result;
	    client.get(url, args, function (data, res) {
	    	try {
		        var statusCode = parseInt(res.statusCode/100);
		        if(statusCode == 2) {
		           result = {
		                status :'success',
		                response: data
		            };
		        } else {            
		            if(data.hasOwnProperty("error")) {
		                var error = data.error;
		                var errMsg = error.message;
		            }
		            result = {
		                status :'error',
		                response : errMsg
		            };            
		        }   
		        callback(result);
		        return result;
		    } catch(e) {
		    	callback({status:"error", response:e.stack});
		    }
	    }).on('error',function(err) {
	       console.log(errMsg, err.request.options);
	    });
	} catch(e) {
		callback({status:"error", response:e.stack});
	}
}

module.exports = (function() {
	var Clearbit = {
        init: function (node) {
        	try {
	            var credentials = node.credentials;
	            apiKey = credentials[0];
	            run(node);
	        } catch(e) {
				emitter.emit('error', e.message, '','',node);
			}
        },
        test: function(request, callback) {
			try {
		      	var credentials = node.credentials;
			    apiKey = credentials[0];
		        testApp(callback);
        	} catch(e) {
        		emitter.emit('error', e.message, '','',node);
        	}
        }
    }
    return Clearbit;
})();