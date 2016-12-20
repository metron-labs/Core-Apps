var Client = require('node-rest-client').Client;
var client = new Client();

svar emitter = require('../core-integration-server-v2/javascripts/emitter');

var accountSid, authToken, baseUrl, fromPhone;


function run(node) {
    var type = node.connection.option;
    var url = "https://api.twilio.com/2010-04-01/Accounts/" + accountSid + "/";
    var obj = node.requestData;
	var postData = "";
	var message, toPhone;
	if(obj.hasOwnProperty("shippingAddress")) {
		toPhone = obj.shippingAddress.phone;
	} else {
		toPhone = obj.defaultAddress.phone;
	}
	if(type.toLowerCase() == "call") {
		url += "Calls.json";
		postData += encodeURIComponent(baseUrl)
	} else {
		url += "Messages.json";
		postData += "Body=" + encodeURIComponent(obj.message);
	}
	postData += "&From=" + encodeURIComponent(fromPhone) + "&To="+ encodeURIComponent(toPhone);
	var args = {
        data : postData,
        headers : {
            Authorization : "Basic " + b64EncodeUnicode(accountSid + ":" + authToken),
            Accept : "application/json",
            "Content-Type" : "application/x-www-form-urlencoded"
        }
    }; 
    client.post(url, args, function (data, res) {
        var status  = parseInt(res.statusCode/100) ;
        if(status == 2) {
            post(data, node);
        } else {
            var errMsg = 'Something went wrong on the request';
            if(data.hasOwnProperty("detail")) {
                errMsg = data.detail;
            } else {
                errMsg = data.message;
            }
            console.log(errMsg);
            // emitter.emit('error',errMsg,args.data,url,node);
        }    
     }).on('error',function(err) {
        console.log('Something went wrong on the request', err.request.options);
      //  emitter.emit("error",'Something went wrong on the request', args.data, url, node);
    });
}
    
function b64EncodeUnicode(str) {
    return new Buffer(str).toString('base64');
}

function post(response, node) {
	console.log("Twilio Response: %j", response);
    node.resData = response;
   emitter.emit("success",node);
    //post req to the core server
}

function testApp() {
    var url = "https://api.twilio.com/2010-04-01/Accounts/" + accountSid + "/Addresses.json";
    var args = {
        headers : {
            Authorization : "Basic " + b64EncodeUnicode(accountSid + ":" + authToken),
            Accept : "application/json"
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
            var errMsg = 'Something went wrong on the request';
            if(data.hasOwnProperty("detail")) {
                errMsg = data.detail;
            } else {
                errMsg = data.message;
            }
            result = {
                status :'error',
                response : errMsg
            };            
        }   
        console.log(result);
        return result;            
    }).on('error',function(err) {
       console.log('Something went wrong on the request', err.request.options);
    });
}

module.exports = (function () {
    var Twilio = {
        init: function (node) {
            //initial function to get request data
            var credentials = node.credentials;
           	accountSid = credentials.accountSid;
            authToken = credentials.authToken;
            fromPhone = credentials.fromPhone;
            baseUrl = credentials.url;
            run(node);
        },
        test: function(request) {
            var credentials = request.credentials;
            accountSid = credentials.accountSid;
            authToken = credentials.authToken;
            fromPhone = credentials.fromPhone;
            baseUrl = credentials.url;
            testApp();
        }
    }
    return Twilio;
})();