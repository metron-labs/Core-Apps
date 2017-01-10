var Client = require('node-rest-client').Client;
var client = new Client();

var emitter = require('../core-integration-server-v2/javascripts/emitter');

var apiKey;
var errMsg = 'Error in connecting Clearbit';

function run(node) {
	try {	
		var obj = node.reqData;
		var url = "https://person.clearbit.com/v2/combined/find?email=" + obj.email;
		var args = {
			headers:{Authorization : "Bearer " + apiKey, Accept : "application/json" }
		};
		setTimeout(function(){
			client.get(url,args,function(data,res) {
				try {
					var status = parseInt(res.statusCode/100);
					if(status == 2) {
						var msg = 'Person with email id ' + obj.email + ' had found in Clearbit';
						post(data, node, msg);
					} else {					
						if(data.hasOwnProperty("error")) {
			        		var error = data.error;
			        		errMsg = error.message;
			        	}
						emitter.emit('error', errMsg, "", url, node);
					}
				} catch(e) {
					emitter.emit('error', e.message, e.stack, url, node);
				}
			}).on('error',function(err) {
				emitter.emit("error", errMsg,err, url, node);
			});	
		}, 5000);
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
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
		emitter.emit('error', e.message, e.stack,'',node);
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

function test(request, callback) {
	try {
      	var credentials = request.credentials;
	    apiKey = credentials.apiKey;
        testApp(callback);
	} catch(e) {
		callback({status:"error", response:e.stack});
	}
}

function init(node) {
	try {
        var credentials = node.credentials;
        apiKey = credentials.apiKey;
        run(node);
    } catch(e) {
		emitter.emit('error', e.message, e.stack,'',node);
	}
}

var Clearbit = {
	init :  init,
	test : test
};

module.exports = Clearbit;