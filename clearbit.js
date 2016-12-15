var Client = require('node-rest-client').Client;
var client = new Client();

//var emitter = require('../javascripts/emitter');

var apiKey;
var errMsg = 'Something went wrong on the request';

function run(node) {
	var type = node.connection.option;
	var obj = node.requestData;
	var url = "https://person-stream.clearbit.com/v2/combined/find?email=" + obj.email;
	var args = {
		headers:{ Authorization : "Bearer " + apiKey, "Accept" : "application/json" }
	};
	client.get(url,args,function(data,res) {
        var status = parseInt(res.statusCode/100);
		if(status == 2) {
            post(data, node);
        } else {
        	var errMsg = 'errMsg';
        	if(data.hasOwnProperty("error")) {
        		var error = data.error;
        		var errMsg = error.message;
        	}
            console.log(errMsg);
            // emitter.emit('error', errMsg,args.data, url, node);
        }	
    }).on('error',function(err) {
		console.log(errMsg, err.request.options);
	//	emitter.emit("error", errMsg,args.data, url, node);
	});
}

function b64EncodeUnicode(str) {
    return new Buffer(str).toString('base64');
}

function post(response, node) {
	console.log(" Clearbit Response: %j",response);
    node.resData = response;
  //  emitter.emit("success", node);
    //post req to the core server
}

function testApp() {
    var url = "https://company-stream.clearbit.com/v2/companies/find?domain=neemtecsolutions.com";
    var args = {      
        headers : {
            "Authorization" : "Bearer " + apiKey,
            "Accept" : "application/json",
        }
    };
    var result;
    client.get(url, args, function (data, res) {
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
        console.log(result);
        return result;            
    }).on('error',function(err) {
       console.log(errMsg, err.request.options);
    });
}

module.exports = (function() {
	var Clearbit = {
        init: function (node) {
            //initial function to get request data
            var credentials = node.credentials;
            apiKey = credentials.apiKey;
            run(node);
        },
        test: function(request) {
            var credentials = request.credentials;
            apiKey = credentials.apiKey;
            testApp();
        }
    }
    return Clearbit;
})();