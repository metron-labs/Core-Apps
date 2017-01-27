var Client = require('node-rest-client').Client;
var async = require('async');
var usStates = require('./json/us_states');
var client = new Client();

var emitter = require('../core-integration-server-v2/javascripts/emitter');

var shippoToken, fromName, fromPhone, fromCompany, fromStreet, fromCity,
fromState, fromCountryCode, fromZip, parcelLength, parcelWidth,
parcelHeight, parcelWeight, actionName;

var netQuantity = 0;
var arrayLength = 0;
var finalDataArr = [];
var errMsg = 'Error in connecting Shippo';

function run(node) {
	try {
		var type = node.option.toLowerCase();
		var nodeType = node.connector.type;
		actionName = node.connection.actionName.toLowerCase();
		var url = "https://api.goshippo.com/v1/";	
		var args = {
			headers: { Authorization: "ShippoToken " + shippoToken }
		};
		if(nodeType.toLowerCase() == "trigger") {
			if(type == "order"){
				url += "orders?page=1&results=100";
			} else {
				url += "transactions?page=1&results=100";
			}
			getStoreData(url, args, type, node);
		} else {
			createOrder(url, type, node);
		}	
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function getStoreData(url, args, type, node) {
	try {
		client.get(url,args,function(data,res) {
			var status = parseInt(res.statusCode/100);
			if(status == 2) {
				var dataLength = data.count;
				var msgPrefix = 'No ';
				var type = node.option.toLowerCase();
				if(node.optionType.toLowerCase() == 'new') {
					msgPrefix = 'No new ';
				} 
				if(dataLength == 0) {
					emitter.emit('error', msgPrefix + type + 's found in Shippo', '', url, node);
				}
				arrayLength += data.results.length;
				var results = data.results;
				finalDataArr = finalDataArr.concat(results);
				if(dataLength == arrayLength) {
					if(type == "order") {
						formOrder(finalDataArr, args, node);
					} else {
						formTransaction(finalDataArr, args, node);
					}
				} else {
					var newUrl = data.next;
					getStoreData(newUrl,args,type,node);
				}	
			} else {
				if(status == 5) {
					emitter.emit('error', 'Server Error in Shippo', '', url, node);
				} else {
					if(data.hasOwnProperty("detail")) {
						errMsg = data.detail;
					}
					emitter.emit('error', errMsg, "", url, node);
				}
			}	
		}).on('error', function(err){
			emitter.emit('error', errMsg, '', url, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}

}

function formOrder(dataArr, args, node){
	try {
		var obj,resObj;
		var resArr = [];
		for(var i = 0; i < dataArr.length; i++) {
			resObj = {};
			obj = dataArr[i];
			resObj.id = obj.object_id;
			resObj.name = obj.order_number;
			resObj.status = obj.order_status;
			resObj.createdAt = obj.created_at;
			resObj.price = obj.total_price;
			resObj.email = obj.address_from.email;
			var billAddr = {};
			billAddr.name = obj.address_from.name;		
			billAddr.company = obj.address_from.company;
			billAddr.phone = obj.address_from.phone;
			billAddr.street = obj.address_from.street1;
			billAddr.city = obj.address_from.city;
			billAddr.state = obj.address_from.state;
			billAddr.country = obj.address_from.country;
			billAddr.zip = obj.address_from.zip;
			resObj.billingAddress = billAddr;
			var shipAddr = {};
			shipAddr.name = obj.to_address.name;
			shipAddr.company = obj.to_address.company;
			shipAddr.phone = obj.to_address.phone;
			shipAddr.street = obj.to_address.street1;
			shipAddr.city = obj.to_address.city;
			shipAddr.state = obj.to_address.state;
			shipAddr.country = obj.to_address.country;
			shipAddr.zip = obj.to_address.zip;
			resObj.shippingAddress = shipAddr;
			var items = [];
			var itemArr = obj.items;
			if(itemArr.length != 0) {
				var item,itemObj;
				var sku = '';
				for(var j = 0; j < itemArr.length; j++) {
					item = {};
					itemObj = itemArr[j];
					item.id = itemObj.id;
					item.name = itemObj.title;
					item.price = itemObj.price;
					item.quantity = itemObj.quantity;
					if(itemObj.hasOwnProperty('sku')) {
						sku = itemObj.sku;
					}
					item.sku = sku;
					items[j] = item;
				}
			}
			resObj.items = items;
			resObj.transactionsId = '';
			resObj.trackingNo = '';
			resObj.shippingAmount = '';
			resObj.updatedAt = '';
			resObj.rateId = '';
			resObj.slackFlag = false;
			if(actionName == 'slack' && i == 0) {
				resObj.slackFlag = true;
			}
			resObj.isLast = false;
			if(i == dataArr.length-1) {
				resObj.isLast = true;
			}
			if(obj.hasOwnProperty("transactions") && obj.transactions.length != 0){
				var transObj;
				transObj = obj.transactions[0];
				resObj.transactionsId = transObj.object_id;
			}
			resArr[i] = resObj;	
		} 
		getOrderTransactions(resArr, args, node);
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function getOrderTransactions(resArr, args, node) {
	try {
		var obj, resObj,transUrl = '';
		var length = resArr.length;
		async.forEach(resArr,function(resObj){
			if(resObj.transactionsId == '') {
				length--;
				if(length == 0) {
					getOrderRates(resArr, args, node);
				}
			} else {			
				transUrl = "https://api.goshippo.com/v1/transactions/" + resObj.transactionsId;
				client.get(transUrl, args, function(data, res) { 
					var status = parseInt(res.statusCode/100);
					if(status == 2) {
						resObj.trackingNo = data.tracking_number;
						resObj.updatedAt = data.object_updated;
						var rateId = data.rate;
						resObj.rateId = rateId;
						length--;	
						if(length == 0) {
							getOrderRates(resArr, args, node);
						}						
					} else {
						if(status == 5) {
							emitter.emit('error', 'Server Error in Shippo', '', transUrl, node);
						} else {					
							if(data.hasOwnProperty("detail")) {
								errMsg = data.detail;
							}
							emitter.emit('error', errMsg, "", transUrl, node);
						}
					}																
				}).on('error', function(err){
					emitter.emit('error', errMsg, "", transUrl, node);
				});
			}}, function(error) {
				emitter.emit('error', errMsg, '', transUrl, node);
			});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}			
}

function getOrderRates(resArr, args, node) {
	try {
		var length = resArr.length;
		async.forEach(resArr,function(resObj){
			if(resObj.rateId == ''){
				length--;
				if(length == 0) {
					post(resArr, node, "");
				}
			} else {			
				var rateUrl = "https://api.goshippo.com/v1/rates/" + resObj.rateId;
				client.get(rateUrl, args, function(data, res) {
					var status = parseInt(res.statusCode/100);
					if(status == 2) {
						var amount = data.amount;
						var margin = amount * 0.15;
						shippingCost = +amount + +margin;
						resObj.shippingAmount = shippingCost;
						length--;
						if(length == 0) {
							post(resArr, node, "");
						}
					} else {
						if(status == 5) {
							emitter.emit('error', 'Server Error in Shippo', '', rateUrl, node);
						} else {
							if(data.hasOwnProperty("detail")) {
								errMsg = data.detail;
							}
							emitter.emit('error', errMsg, "", rateUrl, node);
						}
					}					
				}).on('error', function(err) {
					emitter.emit('error', errMsg, "", rateUrl, node);
				});
			}}, function(error){
				emitter.emit('error', errMsg, '', rateUrl, node);
			});
	} catch(e) {
		emitter.emit('error',e.message, e.stack, "", node);
	}
}

function formTransaction(dataArr, args,node) {
	try {
		var obj,resObj;
		var resArr = [];	
		for(var i = 0; i < dataArr.length;i++) {		
			resObj = {};
			obj = dataArr[i];
			resObj.id = obj.object_id;
			resObj.name = obj.object_id;
			resObj.email = obj.object_owner;
			var status = "UNKNOWN";
			var errSubject = "Shippo Transaction : " + obj.object_id;
			
			if(obj.tracking_status != null) {
				status = obj.tracking_status.status;
				errMsg = obj.tracking_status.status_details;
			}
			resObj.status = status;
			if(obj.messages.length > 0) {
				errMsg = obj.messages[0].text;
			} else if(errMsg == null || errMsg == ''){
				if(status.toUpperCase() == "UNKNOWN") {
					errMsg = "The package has not been found via the carrier's tracking system, "
					+ "or it has been found but not yet scanned by the carrier";
				} else if(status.toUpperCase() == "FAILURE") {
					errMsg = "The carrier indicated that there has been an issue with the delivery."
					+ " This can happen for various reasons and depends on the carrier. "
					+ "This status does not indicate a technical, but a delivery issue.";
				} else if(status.toUpperCase() == "TRANSIT") {
					errMsg = "The package has been scanned by the carrier and is in transit.";
				} else if(status.toUpperCase() == "DELIVERED") {
					errMsg = "The package has been successfully delivered.";
				} else if(status.toUpperCase() == "RETURNED") {
					errMsg = "The package is en route to be returned to the sender,"
					+ " or has been returned successfully.";
				}
			}
			resObj.errMsg = errSubject + ' ' + errMsg;
			resObj.createdAt = obj.object_created;
			resObj.updatedAt = obj.object_updated;
			resObj.rateId = obj.rate;
			resObj.slackFlag = false;
			if(actionName == 'slack' && i == 0) {
				resObj.slackFlag = true;
			}
			resObj.isLast = false;
			if(i == dataArr.length-1) {
				resObj.isLast = true;
			}
			resArr[i] = resObj;
		}
		getTransactionsRate(resArr, args, node);
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function getTransactionsRate(resArr, args, node) {
	try {
		var length = resArr.length;	
		async.forEach(resArr,function(resObj){
			if(resObj.rateId == ''){
				length--;
				if(length == 0) {
					getShipment(resArr, args, node);
				}
			} else {			
				var rateUrl = "https://api.goshippo.com/v1/rates/" + resObj.rateId;
				client.get(rateUrl, args, function(data, res) {
					var status = parseInt(res.statusCode/100);
					if(status == 2) {
						resObj.shippingAmount = data.amount;
						resObj.shipmentId = data.shipment;
						length--;
						if(length == 0) {
							getShipment(resArr, args, node);
						}
					} else {
						if(status == 5) {
							emitter.emit('error','Server Error in Shippo', '', newUrl, node);
						} else {
							if(data.hasOwnProperty("detail")) {
								errMsg = data.detail;
							}
							emitter.emit('error',errMsg,"",rateUrl, node);
						}
					}
				}).on('error', function(err) {
					emitter.emit('error', errMsg, "", rateUrl, node);
				});
			}}, function(error){
				emitter.emit('error', errMsg, '', rateUrl, node);
			});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}	
}

function getShipment(resArr, args, node) {
	try {
		var length = resArr.length;	
		async.forEach(resArr,function(resObj){
			if(resObj.shipmentId == ''){
				length--;
				if(length == 0) {
					getAddress(resArr, args, node);
				}
			} else {			
				var shipmentUrl = "https://api.goshippo.com/v1/shipments/" + resObj.shipmentId;
				client.get(shipmentUrl, args, function(data, res) {
					var status = parseInt(res.statusCode/100);
					if(status == 2) {
						if(data.object_status.toUpperCase() == "ERROR" 
							|| data.object_state.toUpperCase() == "INVALID" ) {
							if(resObj.errMsg == '' && data.messages.length > 0) {
								resObj.errMsg = data.messages[0].text;
							}
						}
						resObj.declId = data.customs_declaration;
						resObj.addressId = data.address_to;
						length--;
						if(length == 0) {
							getAddress(resArr, args, node);
						}
					} else {
						if(status == 5) {
							emitter.emit('error','Server Error in Shippo', '', newUrl, node);
						} else {
							if(data.hasOwnProperty("detail")) {
								errMsg = data.detail;
							}
							emitter.emit('error', errMsg, "", shipmentUrl, node);
						}
					}				
				}).on('error', function(err) {
					emitter.emit('error', errMsg, "", shipmentUrl, node);
				});
			}}, function(error){
				emitter.emit('error', errMsg, '', shipmentUrl, node);
			});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}	
}

function getAddress(resArr, args, node) {
	try {
		var length = resArr.length;	
		async.forEach(resArr,function(resObj){
			if(resObj.addressId == ''){
				length--;
				if(length == 0) {
					getCustomDeclarations(resArr, args, node);
				}
			} else {			
				var addressUrl = "https://api.goshippo.com/v1/addresses/" + resObj.addressId;
				client.get(addressUrl, args, function(data, res) {
					var status = parseInt(res.statusCode/100);
					if(status == 2) {
						if( data.object_state.toUpperCase() == "INVALID" ) {
							if(resObj.errMsg == '' && data.messages.length > 0) {
								resObj.errMsg = data.messages[0].text;
							}
						}
						resObj.email = data.email;
						var addr = {};
						addr.name = data.name;
						addr.phone = data.phone;
						addr.company = data.company;
						addr.street = data.street1;
						addr.city = data.city;
						addr.state = data.state;
						addr.country = data.country;
						resObj.billingAddress = addr;
						resObj.shippingAddress = addr;
						length--;
						if(length == 0) {
							getCustomDeclarations(resArr, args, node);
						}	
					} else {
						if(status == 5) {
							emitter.emit('error','Server Error in Shippo', '', newUrl, node);
						} else {
							if(data.hasOwnProperty("detail")) {
								errMsg = data.detail;
							}
							emitter.emit('error', errMsg, "", addressUrl, node);
						}
					}
				}).on('error', function(err) {
					emitter.emit('error', errMsg, "", addressUrl, node);
				});
			}
		}, function(error){
			emitter.emit('error', errMsg, '', addressUrl, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function getCustomDeclarations(resArr, args, node) {
	try {
		var length = resArr.length;
		async.forEach(resArr, function(resObj){
			if(resObj.declId == '' || resObj.declId == null) {
				length--;	
				resObj.items = [];		
				if(length == 0) {
					post(resArr, node, "");
				}
			} else {			
				var declUrl = "https://api.goshippo.com/v1/customs/declarations/" + resObj.declId;
				client.get(declUrl, args, function(data, res) {
					var  status = parseInt(res.statusCode/100);
					if(status == 2) {
						if(data.object_state.toUpperCase() == "INVALID" ) {
							if(resObj.errMsg == '' && data.messages.length > 0) {
								resObj.errMsg = data.messages[0].text;
							}
						}
						var items = data.items;
						var products = [];
						var i = 0;
						var itemsLength = items.length;
						async.forEach(items, function(item) {
							var itemUrl = "https://api.goshippo.com/v1/customs/items/" + item;
							client.get(itemUrl, args, function(data1, res1) {
								var status1 = parseInt(res1.statusCode/100);
								if(status1 == 2) {
									if(data.object_state.toUpperCase() == "INVALID" ) {
										if(resObj.errMsg == '' && data.messages.length > 0) {
											resObj.errMsg = data.messages[0].text;
										}
									}
									var prod = {};
									prod.name = data1.description;
									quantity = data1.quantity
									prod.quantity = data1.quantity;
									prod.price = data1.value_amount;
									resObj.currency = data1.value_currency;
									products[i] = prod;						
									i++;
									itemsLength--;
									if(itemsLength == 0) {
										resObj.items = products;
										var price = 0;
										var quantity = 0;
										var obj;
										for(var j = 0; j < products.length; j++) {
											obj = products[j];
											quantity += +obj.quantity;
											price += obj.price * obj.quantity;
										}
										resObj.price = price;
										resObj.quantity = quantity;
										length--;
									}							
									if(length == 0) {
										post(resArr, node, "");
									}
								} else {
									if(data.hasOwnProperty("detail")) {
										errMsg = data.detail;
									}
									emitter.emit('error', errMsg, "", itemUrl, node);
								}							
							}).on('error', function(err) {
								emitter.emit('error', errMsg, "", itemUrl, node);
							});
						}, function(error){
							emitter.emit('error', error, "", itemUrl, node);
						});
					} else {
						if(status == 5) {
							emitter.emit('error','Server Error in Shippo', '', newUrl, node);
						} else {
							if(data.hasOwnProperty("detail")) {
								errMsg = data.detail;
							}
							emitter.emit('error', errMsg, "", declUrl, node);
						}
					}	
				}).on('error', function(err) {
					emitter.emit('error', errMsg, '', declUrl, node);
				});
			}				
		}, function(error){
			emitter.emit('error', errMsg, '', declUrl, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

String.prototype.findCode = function (s) {
	var str = this.toLowerCase();
	s = s.toLowerCase();
	if (str.indexOf(s) == -1) {
		return false;
	}
	return true;
};

function getUSProvinceCode(usstate) {
	for(key in usStates) {
		if(key.findCode(usstate)) {
			return usStates[key];
		}
	}	
}

function createOrder(url, type, node) {
	try { 
		var newUrl = url + "orders";
		var items = [];	
		var obj = node.reqData;
		var itemObj, item, postData, country, state,length = 0;
		for(var j = 0; j < obj.items.length; j++) {
			var currency = "USPS";
			item = {};
			itemObj = obj.items[j];
			item.title = itemObj.name;
			item.quantity = itemObj.quantity;
			netQuantity += itemObj.quantity;
			item.price = itemObj.price;
			item.sku = itemObj.sku;
			if(itemObj.hasOwnProperty("currency")) {
				currency = itemObj.currency;
			}
			item.currency = currency;
			items[j] = item;
		}		
		country = obj.shippingAddress.country;
		if(country.length > 3) {
			if(country.toLowerCase() == "united states") {
				country = "US";
			} else {
				country = country.substring(0,2).toUpperCase();
			}			
		}
		if (obj.shippingAddress.state.length == 2) {
			state = obj.shippingAddress.state;
		}else if(country == 'US') {
			state = getUSProvinceCode(obj.shippingAddress.state);
		} else {
			state = obj.shippingAddress.state.substring(0,2).toUpperCase();
		}
		postData = {
			order_number : obj.id,
			total_price : obj.price,
			address_from : {
				object_purpose : "PURCHASE",
				name : fromName,
				company : fromCompany,
				street1 : fromStreet,
				city : fromCity,
				state : fromState,
				country : fromCountryCode,
				zip : fromZip,
				phone : fromPhone,
				email : obj.email,
				metadata : 'Order ID ' + obj.id,
				validate : true
			},
			to_address :{
				object_purpose : "PURCHASE",
				name : obj.shippingAddress.name,
				company : obj.shippingAddress.company,
				street1 : obj.shippingAddress.street,
				city : obj.shippingAddress.city,
				state : state,
				country : country,
				zip : obj.shippingAddress.zip,
				phone : obj.shippingAddress.phone,
				email : obj.email,
				metadata : 'Order ID ' + obj.id,
				validate : true
			},		
			metadata : 'Order Id ' + obj.id,
			items : items
		};
		var args = {
			data : postData,
			headers : { 
				Authorization : 'ShippoToken ' + shippoToken, 
				Accept : "application/json",
				"Content-Type" : "application/json"
			}
		};		
		client.post(newUrl, args, function(data, res) {
			var status = parseInt(res.statusCode/100);
			if(status == 2) {			
				if(type == "order") {
					var msg = 'Order with the id '+ obj.id +' created successfully in Shippo';
					post(data, node, msg);
				} else {
					postCustomItem(url, data,node);
				}
			} else {
				if(status == 5) {
					emitter.emit('error','Server Error in Shippo', '', newUrl, node);
				} else {
					if(data.hasOwnProperty("detail")) {
						errMsg = data.detail;
					} else if (data.hasOwnProperty("messages") && data.messages.length > 0) {
						errMsg = data.messages[0].text;
					} else if(data.hasOwnProperty('address_from')) {
						errMsg = data.address_from[0].__all__[0] + ' in from address';
					} else if(data.hasOwnProperty('to_address')) {
						errMsg = data.to_address[0].__all__[0] + ' in to address';
					} else if(data.hasOwnProperty('items')) {
						errMsg = data.items[0].__all__[0];
					} else if(data.hasOwnProperty('__all__')) {
						errMsg = data.__all__[0];
					}				
					emitter.emit('error',errMsg, args.data, newUrl, node);
				}
			}
		}).on('error', function(err) {
			emitter.emit('error', errMsg, args.data, newUrl, node)
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function postCustomItem(url, orderObj, node) {
	try {
		var newUrl = url + "customs/items";
		var itemArr = orderObj.items;
		var itemsLength = itemArr.length;
		async.forEach(itemArr,function(itemObj) {
			var postData = {
				metadata : "Order ID " + orderObj.order_number,
				description : itemObj.title,
				quantity : itemObj.quantity,
				value_amount : itemObj.price,
				net_weight : itemObj.quantity,
				mass_unit : itemObj.weight_unit,
				origin_country : fromCountryCode
			};
			var args = {
				data : postData,
				headers : { 
					Authorization : "ShippoToken " + shippoToken, 
					Accept : "application/json",
					"Content-Type" : "application/json" 
				}
			};
			client.post(newUrl, args, function(data, res) {
				var status = parseInt(res.statusCode/100);
				if(status == 2) {
					itemObj.customsId = data.object_id;
					itemsLength--;
					if(itemsLength == 0) {
						postCustomDeclarations(url,orderObj, node);
					}					
				} else {
					if(status == 5) {
						emitter.emit('error','Server Error in Shippo', '', newUrl, node);
					} else {
						if(data.hasOwnProperty("detail")) {
							errMsg = data.detail;
						} else if (data.hasOwnProperty("messages") && data.messages.length > 0) {
							errMsg = data.messages[0].text;
						} else if(data.hasOwnProperty(__all__)) {
							errMsg = data.__all__[0];
						}					
						emitter.emit('error', errMsg, newUrl, args.data, node);
					}
				}
			}).on('error', function(err) {
				emitter.emit('error', errMsg, args.data, newUrl, node);
			});
		}, function(error) {
			emitter.emit('error', errMsg, '', newUrl, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}				
}

function postCustomDeclarations(url, orderObj, node) {
	try {
		var newUrl = url + "customs/declarations";
		var postData;
		var itemArr = orderObj.items;
		var customIds = [];
		var itemObj;
		for(var j = 0; j < itemArr.length; j++) {
			itemObj = itemArr[j];
			customIds[j] = itemObj.customsId;
		}
		postData = {
			metadata : "Order ID " + orderObj.order_number,
			non_delivery_option :"RETURN",
			contents_type : "MERCHANDISE",
			certify :true,
			certify_signer : fromName,
			items : customIds
		};
		var args = {
			data : postData,
			headers : { 
				Authorization : "ShippoToken " + shippoToken, 
				Accept : "application/json",
				"Content-Type" : "application/json" 
			}
		};
		client.post(newUrl,args, function(data, res) {
			var status = parseInt(res.statusCode/100);
			if(status == 2) {
				orderObj.customDeclId = data.object_id;
				postShipment(url,orderObj, null, "order",node);
			} else {
				if(status == 5) {
					emitter.emit('error','Server Error in Shippo', '', newUrl, node);
				} else {
					if(data.hasOwnProperty("detail")) {
						errMsg = data.detail;
					} else if (data.hasOwnProperty("messages") && data.messages.length > 0) {
						errMsg = data.messages[0].text;
					} else if(data.hasOwnProperty(__all__)) {
						errMsg = data.__all__[0];
					}				
					emitter.emit('error', errMsg, args.data, newUrl, node);
				}
			}
		}).on('error', function(err) {
			emitter.emit('error', errMsg, args.data, newUrl, node);
		});	
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function postShipment(url, orderObj, transObj, tag, node) {
	try{
		var newUrl = url + "shipments";
		var  postData;
		var returnOf = '';
		if( tag.toLowerCase() == "transaction") {			
			returnOf = transObj.object_id;
		} 		
		postData = {
			object_purpose : "PURCHASE",
			address_from : {
				object_purpose : "PURCHASE",
				name : fromName,
				company : fromCompany,
				street1 : fromStreet,
				city : fromCity,
				state : fromState,
				country : fromCountryCode,
				zip : fromZip,
				phone : fromPhone,
				email : orderObj.address_from.email,
				metadata : orderObj.address_from.metadata,
				validate : true
			},
			address_to :{
				object_purpose : "PURCHASE",
				name : orderObj.to_address.name,
				company : orderObj.to_address.company,
				street1 : orderObj.to_address.street1,
				city : orderObj.to_address.city,
				state : orderObj.to_address.state,
				country : orderObj.to_address.country,
				zip : orderObj.to_address.zip,
				phone : orderObj.to_address.phone,
				email : orderObj.to_address.email,
				metadata : orderObj.to_address.metadata,
				validate: true
			},
			return_of : returnOf,
			parcel : {
				length : parcelLength,
				width : parcelWidth,
				height : parcelHeight,
				weight : netQuantity,
				distance_unit : distanceUnit,
				mass_unit : massUnit,
				metadata : 'Order ID ' + orderObj.order_number
			},			
			customs_declaration : orderObj.customDeclId,
			reference_1 : orderObj.order_number,
			reference_2 : "Order Number",
			metadata : 'Order ID ' + orderObj.order_number,
			async : false
		};
		var args = {
			data : postData,
			headers : { Authorization : 'ShippoToken ' + shippoToken,
			Accept : "application/json", "Content-Type" : "application/json"}
		};
		client.post(newUrl, args, function(data, res) {
			var status = parseInt(res.statusCode/100);
			if(status == 2) {
				postTransaction(url, orderObj, data, tag, node);				
			} else {
				if(status == 5) {
					emitter.emit('error','Server Error in Shippo', '', newUrl, node);
				} else {
					if(data.hasOwnProperty("detail")) {
						errMsg = data.detail;
					} else if (data.hasOwnProperty("messages") && data.messages.length > 0) {
						errMsg = data.messages[0].text;
					} else if(data.hasOwnProperty('address_from')) {
						errMsg = data.address_from[0].__all__[0] + ' in from address';
					} else if(data.hasOwnProperty('address_to')) {
						errMsg = data.address_to[0].__all__[0] + ' in to address';
					} else if(data.hasOwnProperty('parcel')) {
						errMsg = data.parcel[0].__all__[0];
					} else if(data.hasOwnProperty('__all__')) {
						errMsg = data.__all__[0];
					}					
					emitter.emit('error', errMsg, args.data, newUrl, node);
				}
			}
		}).on('error', function(err) {
			emitter.emit("error", errMsg, args.data, newUrl, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function postTransaction(url, orderObj, shipObj, tag, node) {
	try {
		var newUrl = url + "transactions";		
		var rateObj;
		var rates = shipObj.rates_list;
		var price = orderObj.total_price;
		var days = 1;
		var carrier = "USPS";
		var amount = 0;
		var rate = '';
		if(price <= 100) {
			days = 3;
		} else if(price >= 100 && price <= 200) {
			days = 2;
		}
		for(var j = 0; j < rates.length; j++) {
			var rateObj = rates[j];
			if(rateObj.provider.toLowerCase() == carrier.toLowerCase()) {
				if(amount == 0 && (rateObj.days == days || (days == 3 && rateObj.days >=3))) {
					rate = rateObj.object_id;
					amount = rateObj.amount;
				}
				if(amount > rateObj.amount && (rateObj.days == days || (days == 3 && rateObj.days >=3))) {
					rate = rateObj.object_id;
					amount = rateObj.amount;
				}
			}
		}
		if(rate == '') {
			rate = rates[0].object_id;
		}
		postData = {
			order : orderObj.object_id,
			rate : rate
		};
		var args = {
			data : postData,
			headers : { Authorization : 'ShippoToken ' + shippoToken, Accept : "application/json", "Content-Type" : "application/json"}
		};
		client.post(newUrl, args, function(data, res) {
			var status = parseInt(res.statusCode/100);
			if(status == 2) {
				findResult(url, orderObj, data, tag, node);						
			} else {
				if(data.hasOwnProperty("detail")) {
					errMsg = data.detail;
				} else if (data.hasOwnProperty("messages") && data.messages.length > 0) {
					errMsg = data.messages[0].text;
				} else if(data.hasOwnProperty('rate')) {
					errMsg = data.rate[0];
				} else {
					errMsg = 'Required fields are missing (service level token, shipment, carrier account)';
				}
				if(status == 5) {
					emitter.emit('error','Server Error in Shippo', '', newUrl, node);
				}
				emitter.emit('error', errMsg, args.data, newUrl, node);
			}			
		}).on('error', function(err) {
			emitter.emit('error', errMsg, args.data, newUrl, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function findResult(url, orderObj, transObj, tag, node) {
	try {
		var labelType = node.option.toLowerCase();
		var newUrl = url +'transactions/' + transObj.object_id;
		var args = {
			headers : { Authorization : 'ShippoToken ' + shippoToken }
		};
		client.get(newUrl, args, function(data, res) {
			var status = parseInt(res.statusCode/100);
			if(status == 2) {
				var valid = data.object_status;
				if(valid == 'ERROR') {
					errMsg = data.messages[0].text;
					emitter.emit('error', errMsg, data, newUrl, node);
				} else {
					var msg;
					if(labelType == "shipping label") {
						msg = 'Shipping Label for the order ' + orderObj.order_number + ' created successfully';
						post(data, node, msg);
					} else if(labelType == "return label" && tag.toLowerCase() == "transaction") {
						msg = 'Return Label for the order ' + orderObj.order_number + ' created successfully'
						post(data, node, msg);
					} else {
						postShipment(url, orderObj, transObj, "transaction", node);
					}	
				}
			} else {
				if(status == 5) {
					emitter.emit('error','Server Error in Shippo', '', newUrl, node);
				} else {
					if(data.hasOwnProperty("detail")) {
						errMsg = data.detail;
					}
					emitter.emit('error', errMsg, data, newUrl, node);
				}				
			}
		}).on('error', function(err) {
			emitter.emit('error', errMsg, '', newUrl, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack,"",node);
	}
}

function post(response, node, message) {
	node.resData = response;
	emitter.emit("success", node, message);
}

function testApp(callback) {
	try {
		var url = 'https://api.goshippo.com/v1/shipments';
		var args = {
			headers : { Authorization : 'ShippoToken ' + shippoToken }
		};
		var result;
		client.get(url, args, function(data, res) {
			var statusCode = parseInt(res.statusCode/100);
			if(statusCode == 2) {
				result = {
					status : 'success',
					response : data
				};
			} else {
				if(data.hasOwnProperty("detail")) {
					errMsg = data.detail;
				}
				result = {
					status : 'error',
					response : errMsg
				};
			}
			callback(result);
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
		shippoToken = credentials.shippoToken;
		testApp(callback);
	} catch(e) {
		callback({status:"error", response:e.stack});
	}
}

function init(node) {
	try {
		var credentials = node.credentials;
		shippoToken = credentials.shippoToken;
		fromName = credentials.fromName;
		fromPhone = credentials.fromPhone;
		fromCompany = credentials.fromCompany;
		fromStreet = credentials.fromStreet;
		fromCity = credentials.fromCity;
		var state = credentials.fromState;
		fromCountryCode = credentials.fromCountryCode;
		fromZip = credentials.fromZip;
		distanceUnit = credentials.distanceUnit;
		massUnit = credentials.massUnit;
		parcelLength = credentials.parcelLength;
		parcelWidth = credentials.parcelWidth;
		parcelHeight = credentials.parcelHeight;
		parcelWeight = credentials.parcelWeight;
		if(state.length > 2) {
			if(fromCountryCode.toUpperCase() == "US") {
				state = getUSProvinceCode(state);
			} else {
				state = state.substring(0,2).toUpperCase();
			}
		}
		fromState = state;
		run(node);
	} catch(e) {
		emitter.emit('error',e.message, e.stack, "", node);
	}
}

var Shippo = {
	init :  init,
	test : test
};

module.exports = Shippo;