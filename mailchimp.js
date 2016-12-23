var Client = require('node-rest-client').Client;
var client = new Client();

var emitter = require('../core-integration-server-v2/javascripts/emitter');

var apiKey, listId, baseUrl;
var errMsg = 'Something went wrong on the request';

function run(node) {
    try {
        var reqObj = node.requestData;
        var firstName, lastName = '';
        var url = baseUrl + "/3.0/lists/" + listId + "/members";
        if(reqObj.hasOwnProperty("shippingAddress")) {
            firstName = reqObj.billingAddress.name
        } else {
            firstName = reqObj.firstName,
            lastName = reqObj.lastName
        }
        var postData = {
            email_address : reqObj.email,
            status : "subscribed",
            merge_fields : {
                FNAME : firstName,
                LNAME : lastName
            }
        };
        var args = {
            data : postData,
            headers : {
                "Authorization" : "apikey " + apiKey,
                "Accept" : "application/json",
                "Content-Type" : "application/json"
            }
        }; 
        client.post(url, args, function (obj, res) {
            try {
                var data;  
                var status = res.statusCode/100;
                if (status >= 3) {
                    data = JSON.parse(obj);
                    if (data.hasOwnProperty("errors")) {
                        errMsg = data.errors[0].message;                         
                    } else {
                        var detail = data.detail;
                        errMsg = detail;
                        if(detail.includes("already a list member")) {
                            var index = detail.indexOf('U');
                            errMsg = detail.substring(0, index);
                        }
                    }
                    emitter.emit('error',errMsg, postData, url, node);
                } else {
                    data = obj;
                    var msg = "Subscriber created successfully for the email " + reqObj.email;
                    post(data, node, msg);
                }
            } catch(e) {
                emitter.emit('error', e.message,  e.stack, "", node);
            }
        }).on('error',function(err){
            console.log('Something went wrong on the request', err.request.options);
            emitter.emit('error', err, postData, url, node);
        });
    } catch(e) {
        emitter.emit('error', e.message, e.stack, "", node);
    }
}

function post(res, node, message) {
    node.resData = res;
    emitter.emit("success",node,message);   
}

function testApp(callback) {
    try {           
        var url = baseUrl + "/3.0/lists/" + listId + "/members";
        var args = {      
            headers : {
                "Authorization" : "apikey " + apiKey,
                "Accept" : "application/json",
            }
        };
        var result;
        client.get(url, args, function (data, res) {
            try {
                if(res.statusCode/100 == 2) {
                   result = {
                        status :'success',
                        response: data
                    };
                } else {
                    var errMsg;
                    var result = JSON.parse(data);
                    if(result.hasOwnProperty("errors")) {
                        errMsg = result.errors[0].message;
                    } else {
                        var detail = result.detail;
                        errMsg = detail;                              
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
           callback({status:"error", response:err});
        }); 
    } catch(e) {
        callback({status:"error", response:e.stack});
    }
}

module.exports = (function () { 
    var Mailchimp = {
        init: function (node) {
            try {           
                var credentials = node.credentials;
                apiKey = credentials.apiKey;
                listId = credentials.listId;
                baseUrl = credentials.url;
                run(node);
            } catch(e) {
                emitter.emit('error', e.message,  e.stack, "", node);
            }
        }, 
        test(request, callback) {
            try {
                var credentials = request.credentials;
                apiKey = credentials.apiKey;
                listId = credentials.listId;
                baseUrl = credentials.url;
                testApp(callback);
            } catch(e) {
                callback({status:"error", response:e.stack});
            }
        }
    }
    return Mailchimp;
})();