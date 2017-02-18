var Client = require('node-rest-client').Client;
var client = new Client();

var emitter = require('../core-integration-server-v2/javascripts/emitter');

var apiKey, listId, baseUrl;
var errMsg = '"Connection timeout error" in Mailchimp';

function run(node) {
    try {
        var nodeType = node.connector.type.toLowerCase();
        if(nodeType == 'trigger') {
            getStoreData(node);
        } else {
            postStoreData(node);
        }
    } catch(e) {
        emitter.emit('error', e.message, e.stack, "", node);
    }
}

function post(response, node, message) {
    node.resData = response;
    emitter.emit('success', node, message);
}

function postStoreData(node) {
    try {
        var method = node.optionType.toLowerCase();
        var url = baseUrl + "/3.0/lists/" + listId + "/members";
        if(method == 'add') {
            createSubscriber(url, node);
        } else {
            updateSubscriber(url, node);
        }
    } catch(e) {
        emitter.emit('error', e.message, e.stack, "", node);
    }
}

function createSubscriber(url, node) {
    try {
        var reqObj = node.reqData;
        var firstName, lastName = '';
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
                emitter.emit('error', e.message, e.stack, url, node);
            }
        }).on('error',function(err){
            emitter.emit('error', err, postData, url, node);
        });
    } catch(e) {
        emitter.emit('error', e.message, e.stack, "", node);
    }
}

function updateSubscriber(url, node) {
    try {
        var reqObj = node.reqData;
        var postData = {
            email_address : reqObj.email,
            status : "unsubscribed"
        };
        var args = {
            data : postData,
            headers : {
                "Authorization" : "apikey " + apiKey,
                "Accept" : "application/json",
                "Content-Type" : "application/json"
            }
        };
        getMemberId(node, function(id) {
            url += "/" + id;
            client.put(url, args, function(data, res) {
                try {
                    var status = parseInt(res.statusCode/100);
                    if(status == 2) {
                      var msg = "Subscriber updated successfully for the email " + reqObj.email;
                      post(data, node, msg);
                    }
                } catch(e) {
                    emitter.emit('error', e.message, e.stack, url, node);
                }
            }).on('error', function(err) {
                emitter.emit('error', errMsg, args.data, url, node);
            });
        });
    } catch(e) {
        emitter.emit('error', e.message, e.stack, "", node);
    }
}

function getMemberId(node, callback) {
    try {
        var reqObj = node.reqData;
        var url = baseUrl + "/3.0/search-members?query=" + reqObj.email;
        var args = {
            headers : {
                "Authorization" : "apikey " + apiKey,
                "Accept" : "application/json",
                "Content-Type" : "application/json"
            }
        }
        client.get(url, args, function(data, res) {
            try {
                var status = parseInt(res.statusCode/100);
                if(status == 2) {
                    var members = data.exact_matches.members;
                    if(members.length == 0) {
                        createSubscriber(node);
                    } else {
                        var id = data.exact_matches.members[0].id;
                        callback(id);
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

function test(request, callback) {
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

function init(node) {
    try {           
        var credentials = node.credentials;
        apiKey = credentials.apiKey;
        listId = credentials.listId;
        baseUrl = credentials.url;
        run(node);
    } catch(e) {
        emitter.emit('error', e.message,  e.stack, "", node);
    }
}

var Mailchimp = {
    init :  init,
    test : test
};

module.exports = Mailchimp;