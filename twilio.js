var Client = require('node-rest-client').Client;
var client = new Client();

var emitter = require('../core-integration-server-v2/javascripts/emitter');

var accountSid, authToken, baseUrl, fromPhone, textMessage;
var errMsg = 'Error in connecting Twilio';

function run(node) {
    try {
        var msg;
        var type = node.option.toLowerCase();
        var url = "https://api.twilio.com/2010-04-01/Accounts/" + accountSid + "/";
        var obj = node.reqData;
    	var postData = "";
    	var message, toPhone;
    	if(obj.hasOwnProperty("shippingAddress")) {
    		toPhone = obj.shippingAddress.phone;
    	} else {
    		toPhone = obj.defaultAddress.phone;
    	}
    	if(type == "phone") {
    		url += "Calls.json";
            msg = 'Call has been sent successfully to ' + toPhone + ' from Twilio';
    		postData += 'Url=' + encodeURIComponent(baseUrl);
    	} else {
    		url += "Messages.json";
            msg = 'Message has been sent successfully to ' + toPhone + ' from Twilio';
    		postData += "Body=" + encodeURIComponent(textMessage);
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
            try {
                var status  = parseInt(res.statusCode/100) ;
                if(status == 2) {
                    post(data, node, msg);
                } else {
                    if(status == 5) {
                         emitter.emit('error', 'Server Error in Twilio','', url, node);
                    } else {
                        if(data.hasOwnProperty("detail")) {
                            errMsg = data.detail;
                        } else {
                            errMsg = data.message;
                        }
                        emitter.emit('error', errMsg, data, url, node);
                    }
                }
            } catch(e) {
                emitter.emit('error', e.message, e.stack, url, node);
            }   
         }).on('error',function(err) {
           emitter.emit("error",errMsg, '', url, node);
        });
    } catch(e) {
        emitter.emit('error', e.message, e.stack, "", node);
    }
}
    
function b64EncodeUnicode(str) {
    return new Buffer(str).toString('base64');
}

function post(response, node, message) {
    node.resData = response;
    emitter.emit("success",node,message);
}

function testApp(callback) {
    try {
        var url = "https://api.twilio.com/2010-04-01/Accounts/" + accountSid + "/Addresses.json";
        var args = {
            headers : {
                Authorization : "Basic " + b64EncodeUnicode(accountSid + ":" + authToken),
                Accept : "application/json"
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
                    var errMsg = 'Error in connecting Twilio';
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
                 callback(result);
            } catch(e) {
               callback({status:"error", response:e.stack});
            }       
        }).on('error',function(err) {
            callback({status:"error", response:err});
        });
    } catch(e) {
        callback({status:"error", response:e.stack});
    }
}

function test(request, callback) {
    try {
        var credentials = request.credentials;
        accountSid = credentials.accountSid;
        authToken = credentials.authToken;
        fromPhone = credentials.fromPhone;
        testApp(callback);
    } catch(e) {
        callback({status:"error", response:e.stack});
    }
}

function init(node) {
    try {
        var credentials = node.credentials;
        accountSid = credentials.accountSid;
        authToken = credentials.authToken;
        fromPhone = credentials.fromPhone;
        baseUrl = credentials.url;
        textMessage = credentials.textMessage;
        run(node);
    } catch(e) {
        emitter.emit('error', e.message, e.stack, "", node);
    }
}

var Twilio = {
    init :  init,
    test : test
};

module.exports = Twilio;
