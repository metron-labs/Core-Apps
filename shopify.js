var Client = require('node-rest-client').Client;
var async = require('async');
var moment = require('moment-timezone');
var client = new Client();

var emitter = require("../core-integration-server-v2/javascripts/emitter");

var apiKey,apiPassword,storeName, actionName;
var page = 1, count, finalDataArr = [];

var errMsg = 'Error in connecting Shopify';

function getDataCount(node) {
	try {
		var url = "https://" + storeName + ".myshopify.com/admin/";
		var type =  node.option.toLowerCase();
		var newUrl;
		var filterDate = null;
		var args = {
			headers:{ Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + apiPassword) }
		};	    
		if(type == "customer") {
			newUrl = url + "customers/count.json";
		} else if(type == "product") {
			newUrl = url + "products/count.json";
		} else {
			newUrl = url + "orders/count.json";
		}
		if(node.optionType.toLowerCase() == 'new') {
			var pathStartTime = node.connection.startedAt;
			var arr = pathStartTime.split('/');
			var formattedDateStr = arr[1] + '/' + arr[0] + '/' + arr[2];
			var startDate = new Date(formattedDateStr);
			filterDate = toTimeZone(startDate, "YYYY-MM-DDTHH:mm:ssZ", "EDT");
			var instanceTime = node.connection.instanceStartTime;
			arr = instanceTime.split('/');
			formattedDateStr = arr[1] + '/' + arr[0] + '/' + arr[2];
			var thirtyMinutesBefore = new Date(formattedDateStr);
			thirtyMinutesBefore.setMinutes(thirtyMinutesBefore.getMinutes() - 30);
			if(thirtyMinutesBefore.getTime() > startDate.getTime()) {
				filterDate = toTimeZone(thirtyMinutesBefore, "YYYY-MM-DDTHH:mm:ssZ", "EDT");
			}  
		}
		if(filterDate != null) {
			newUrl += "?created_at_min=" + filterDate;
		}
		client.get(newUrl, args, function(data, res) {
			try {
				var status = parseInt(res.statusCode/100);
				if(status == 2) {
					count = data.count;
					var dataUrl;
					if(type == "customer") {
						dataUrl = url + "customers.json?page=" + page + '&limit=10';
					} else if(type == "product") {
						dataUrl = url + "products.json?page=" + page + '&limit=10';
					} else {
						dataUrl = url + "orders.json?page=" + page + '&limit=10';
					}
					if(filterDate != null) {
						dataUrl += "&created_at_min=" + filterDate;
					}
					getStoreData(dataUrl, args, type, node);
				} else {
					errMsg = data.errors;
					emitter.emit('error', errMsg, data, newUrl, node);
				}
			} catch(e) {
				emitter.emit('error',e.message, e.stack, newUrl, node);
			}
		}).on('error',function(err){
			emitter.emit("error",errMsg,"", newUrl, node);
		});
	} catch(e) {
		emitter.emit('error',e.message, "", "", node);
	}
}

function getStoreData(url, args, type, node) {
	try {
		actionName = node.connection.actionName.toLowerCase();
		client.get(url, args, function (data, res) {
			try {
				var status = parseInt(res.statusCode/100);		
				if( status == 2) {
					if(type == "customer") {
						if(data.customers.length == 0 ) {
							emitter.emit("error", 'No data found in Shopify',"",url,node);
							return;
						}
						formCustomer(data.customers,node);
					} else if (type == "product") {
						if(data.products.length == 0 ) {
							emitter.emit("error", 'No data found in Shopify',"",url,node);
							return;
						}
						formProduct(data.products,node);
					} else {
						if(data.orders.length == 0 ) {
							emitter.emit("error", 'No data found in Shopify',"",url,node);
							return;
						}
						formOrder(data.orders,node)
					}
				} else {
					errMsg = data.errors;
					emitter.emit('error', errMsg, data, url, node);
				}
			} catch(e) {
				emitter.emit('error', e.message, e.stack, "", node);
			}
		}).on('error',function(err){
			emitter.emit("error", errMsg, err, url, node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function b64EncodeUnicode(str) {
	return new Buffer(str).toString('base64');
}

function formCustomer(dataArr, node) {
	try {
		var obj, resObj;
		var resArr = [];		
		for(var i = 0; i < dataArr.length; i++) {
			resObj = {};
			obj = dataArr[i];
			resObj.id = obj.id;
			resObj.name = obj.name;
			resObj.email = obj.email;
			resObj.createdAt = obj.created_at;
			resObj.updatedAt = obj.updated_at;
			resObj.firstName = obj.first_name;	
			resObj.lastName = obj.last_name;	
			var addr1 = {};
			addr1.firstName = obj.default_address.first_name;	
			addr1.lastName = obj.default_address.last_name;
			addr1.street = obj.default_address.address1;
			addr1.city = obj.default_address.city;
			addr1.state = obj.default_address.province;
			addr1.stateISO2 = obj.default_address.province_code;
			addr1.country = obj.default_address.country;
			addr1.countryISO2 = obj.default_address.country_code;
			addr1.zip = obj.default_address.zip;
			addr1.phone = obj.default_address.phone;
			resObj.defaultAddress = addr1;
			resObj.slackFlag = false;
			if(actionName == 'slack' && i == 0) {
				resObj.slackFlag = true;
			}
			resObj.isLast = false;
			var length = finalDataArr.length + i;
			if(length == count) {
				resObj.isLast = true;
			}
			resArr[i] = resObj;
		}
		post(resArr, node,"");
		finalDataArr = finalDataArr.concat(resArr);
		if(finalDataArr.length != count) {
			page++;
			getDataCount(node);
		}
	} catch(e) {
		emitter.emit('error',e.message, "", "", node);
	}
}

function formOrder(dataArr, node) {
	try {
		var obj, resObj;
		var resArr = [];
		for(var i = 0; i < dataArr.length; i++) {
			resObj = {};
			obj = dataArr[i];
			resObj.id = obj.id;
			resObj.email = obj.email;
			resObj.createdAt = obj.created_at;
			resObj.updatedAt = obj.updated_at;
			resObj.price = obj.total_price;
			resObj.status = obj.financial_status;
			resObj.name = obj.name;
			resObj.customerId = obj.customer.id;
			resObj.customerName = obj.customer.first_name + ' ' + obj.customer.last_name;
			var billingAddress = {}
			billingAddress.name = obj.billing_address.name;
			billingAddress.street = obj.billing_address.address1;
			billingAddress.city = obj.billing_address.city;
			billingAddress.state = obj.billing_address.province;
			billingAddress.stateISO2 = obj.billing_address.province_code;
			billingAddress.country = obj.billing_address.country;
			billingAddress.countryISO2 = obj.billing_address.countryISO2;
			billingAddress.zip = obj.billing_address.zip;
			billingAddress.phone = obj.billing_address.phone;
			resObj.billingAddress = billingAddress;
			var shippingAddress = {};
			shippingAddress.name = obj.shipping_address.name;
			shippingAddress.street = obj.shipping_address.address1;
			shippingAddress.city = obj.shipping_address.city;
			shippingAddress.state = obj.shipping_address.province;
			shippingAddress.stateISO2 = obj.shipping_address.province_code;
			shippingAddress.country = obj.shipping_address.country;
			shippingAddress.countryISO2 = obj.shipping_address.countryISO2;
			shippingAddress.zip = obj.shipping_address.zip;
			shippingAddress.phone = obj.shipping_address.phone;
			resObj.shippingAddress = shippingAddress;
			resObj.shippingMethod = obj.processing_method;
			resObj.paymentMethod = obj.processing_method;
			var items = [];
			var itemObj,item;
			var quantity = 0;
			for(var j = 0; j < obj.line_items.length; j++) {
				item = {};
				itemObj = obj.line_items[j];
				item.id = itemObj.product_id;
				item.name = itemObj.name;
				item.price = itemObj.price;
				item.quantity = itemObj.quantity;
				item.sku = itemObj.sku;
				items[j] = item;
				quantity += itemObj.quantity;
			}
			resObj.slackFlag = false;
			if(actionName == 'slack' && i == 0) {
				resObj.slackFlag = true;
			}
			resObj.isLast = false;
			var length = finalDataArr.length + i;
			if(length == count) {
				resObj.isLast = true;
			}
			resObj.items = items;
			resObj.quantity = quantity;
			resArr[i] = resObj;
		}
		post(resArr, node,"");
		finalDataArr = finalDataArr.concat(resArr);
		if(finalDataArr.length != count) {
			page++;
			getDataCount(node);
		}
	} catch(e) {
		emitter.emit('error',e.message, e.stack, "", node);
	}
}

function formProduct(dataArr,node) {
	try {
		var obj,resObj;
		var resArr = [];
		for(var i = 0;  i < dataArr.length; i++) {
			resObj = {};
			obj = dataArr[i];
			resObj.id = obj.id;
			resObj.name = obj.title;
			resObj.createdAt = obj.created_at;
			resObj.updatedAt = obj.updated_at;
			resObj.description = obj.body_html;
			resObj.catagory = obj.product_type;
			var variants = obj.variants[0];
			resObj.sku = variants.sku;
			resObj.price = variants.price;
			resObj.qtyOnHand = variants.inventory_quantity;
			resObj.slackFlag = false;
			if(actionName == 'slack' && i == 0) {
				resObj.slackFlag = true;
			}
			resObj.isLast = false;
			var length = finalDataArr.length + i;
			if(length == count) {
				resObj.isLast = true;
			}
			resArr[i] = resObj;
		}
		post(resArr, node,"");
		finalDataArr = finalDataArr.concat(resArr);
		if(finalDataArr.length != count) {
			page++;
			getDataCount(node);
		}
	} catch(e) {
		emitter.emit('error',e.message, e.stack, "", node);
	}
}

function postDataModel(node) {
	try {
		var action = node.optionType.toLowerCase();
		var url = "https://"+storeName+".myshopify.com/admin/";
		var type =  node.option.toLowerCase();
		if(type == "customer" && action == "create") {
			createCustomer(url, node);
		} else if(type == "customer" && action == "update") {
			updateCustomer(url, node);
		} else if(type == "order" && action == "create") {
			getVariantsId(url, node);
		} else if(type == "product" && action == "create") {
			createProduct(url, node.reqData, node);
		} else if(type == "product" && action == "update") {
			getProductId(url, node, 'product');
		}
	} catch(e) {
		emitter.emit('error',e.message, e.stack, "", node);
	}
}

function createCustomer(url, node, callback) {
	try {
		var obj = node.reqData;
		url += "customers.json";
		var lastName = '';
		var name, street, city, state, country, zip, phone, company;
		if(obj.hasOwnProperty("shippingAddress")) {
			name = obj.billingAddress.name;
			street = obj.billingAddress.street;
			city = obj.billingAddress.city;
			state = obj.billingAddress.state;
			country = obj.billingAddress.country;
			zip = obj.billingAddress.zip;
			phone = obj.billingAddress.phone;
			company = obj.billingAddress.company;
		} else {
			name = obj.firstName;
			street = obj.defaultAddress.street;
			city = obj.defaultAddress.city;
			state = obj.defaultAddress.state;
			country = obj.defaultAddress.country;
			zip = obj.defaultAddress.zip;
			phone = obj.defaultAddress.phone;
			company = obj.defaultAddress.company;
		}
		if(obj.hasOwnProperty("lastName")) {
			lastName = obj.lastName;
		}
		var postData = {
			customer : {
				first_name : name,
				last_name : lastName,
				email : obj.email,
				verified_email : true,
				addresses : [{
					address1 : street,
					city : city,
					province : state,
					phone : phone,
					zip : zip,
					last_name : lastName,
					first_name: name,
					country:country
				}],
				"send_email_welcome": false
			}
		};
		var args = {
			data : postData,
			headers : {
				Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + apiPassword),
				"Content-Type": 'application/json',
				Accept : 'application/json'
			}
		};
		setTimeout(function() {
			client.post(url, args, function(data, res) {
				try {
					var status = parseInt(res.statusCode/100);
					if(status == 2) {
						if(typeof callback == 'undefined') {
							var msg = 'Customer with email ' + obj.email + ' has been created successfully in Shopify';
							post(data, node, msg);
						} else {
							var msg = 'Customer with email ' + obj.email + ' has been updated successfully in Shopify';
							post(data, node, msg);
						}					
					} else {
						if(data.hasOwnProperty("errors")) {
							errMsg = data.errors;						
							if(data.errors.hasOwnProperty("email")) {
								errMsg = 'Email ' + data.errors.email[0];
							}			
						}					
						emitter.emit('error', errMsg, data, url, node);
					}
				} catch(e) {
					emitter.emit('error', e.message, e.stack, url, node);
				}
			}).on('error', function(err) {
				emitter.emit('error', errMsg, err, url, node);
			});
		}, 5000);
	} catch(e) {
		emitter.emit('error',e.message, e.stack, "", node);
	}
}

function updateCustomer(url, node) {
	try {
		var obj = node.reqData;		
		var name, street, city, state, country, zip, phone, company;
		if(obj.hasOwnProperty("shippingAddress")) {
			name = obj.billingAddress.name;
			street = obj.billingAddress.street;
			city = obj.billingAddress.city;
			state = obj.billingAddress.state;
			country = obj.billingAddress.country;
			zip = obj.billingAddress.zip;
			phone = obj.billingAddress.phone;
			company = obj.billingAddress.company;
		} else {
			name = obj.firstName;
			street = obj.defaultAddress.street;
			city = obj.defaultAddress.city;
			state = obj.defaultAddress.state;
			country = obj.defaultAddress.country;
			zip = obj.defaultAddress.zip;
			phone = obj.defaultAddress.phone;
			company = obj.defaultAddress.company;
		}
		var lastName = '-';
		if(obj.hasOwnProperty('lastName')) {
			lastName = obj.lastName;
		}
		getCustomerId(url, node, function(customerId, addressId) {		
			var newUrl = url + 'customers/' + customerId + '/addresses/' + addressId +'.json';
			console.log(newUrl);
			var postData = {				
				address : {
					id : addressId,
					last_name : lastName,
					first_name: name,
					address1 : street,
					city : city,
					province : state,
					phone : phone,
					zip : zip,		        		
					country:country					
				}
			};			
			var args = {
				data : postData,
				headers : {
					Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + apiPassword),
					"Content-Type": 'application/json',
					Accept : 'application/json'
				}
			};
			setTimeout(function() {
				client.put(newUrl, args, function(data, res) {
					try {
						var status = parseInt(res.statusCode/100);
						if(status == 2) {
							var msg = 'Customer with email ' + obj.email + ' has been updated successfully in Shopify';
							post(data, node, msg);
						} else {
							if(data.hasOwnProperty("errors")) {
								errMsg = data.errors;						
								if(data.errors.hasOwnProperty("customer_address")) {
									errMsg = data.errors.customer_address;
								}			
							}					
							emitter.emit('error', errMsg, data, newUrl, node);
						}
					} catch(e) {
						emitter.emit('error',e.message, e.stack, newUrl, node);
					}
				}).on('error', function(err) {
					emitter.emit('error', errMsg, err, newUrl, node);
				});
			}, 5000);
		});		
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function getCustomerId(url, node, callback) {
	try {
		var customer = node.reqData;		
		var customerId;		
		var newUrl = url + 'customers/search.json?query=' + customer.email;
		var args = {
			headers : { Authorization : 'Basic ' + b64EncodeUnicode(apiKey + ':' + apiPassword)}
		};
		setTimeout(function() {
			client.get(newUrl, args, function(data, res) {
				try {
					var status = parseInt(res.statusCode/100);
					if(status == 2) {
						var customers = data.customers;
						if(customers.length == 0) {
							createCustomer(url,node, function(id) {
								callback(id);
							});
						} else {						
							var customerId = customers[0].id;		
							callback(customerId);
						}
					} else {
						errMsg = data.errors;
						emitter.emit('error', errMsg, data, newUrl, node);
					}
				} catch(e){
					emitter.emit('error', e.message, e.stack,newUrl, node);
				}
			}).on('error', function(err) {
				emitter.emit('error', errMsg, err, newUrl, node);
			});
		}, 5000);
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function getProductId(url, node, tag, callback) {
	try {
		var item;
		if(tag.toLowerCase() == 'product') {
			item  = node.reqData;
		} else {
			item = node;
		}
		var variantId;		
		var newUrl = url + 'products.json?handle=' + item.name;
		var args = {
			headers : { Authorization : 'Basic ' + b64EncodeUnicode(apiKey + ':' + apiPassword)}
		};
		setTimeout(function() {
			client.get(newUrl, args, function(data, res) {
				try {
					var status = parseInt(res.statusCode/100);
					if(status == 2) {
						var products = data.products;
						if(products.length == 0) {
							createProduct(url,item, function(id) {
								callback(id);
							});
						} else {
							var variants = products[0].variants[0];
							variantId = variants.id;
							if(item.hasOwnProperty('sku') && item.sku != '') {
								if(variants.sku != item.sku) {
									updateProduct(url, item, tag, callback);
								} else {
									callback(variantId);
								}
							} else {						
								callback(variantId);
							}
						}
					} else {
						errMsg = data.errors;
						emitter.emit('error', errMsg, data, newUrl, node);
					}
				} catch(e){
					emitter.emit('error', e.message, e.stack,newUrl, node);
				}
			}).on('error', function(err) {
				emitter.emit('error', errMsg, err, newUrl, node);
			});
		}, 5000);
	} catch(e) {
		emitter.emit('error', e.message, e.stack,"", node);
	}
}

function toTimeZone(time, format, zone) {
    return moment(time).tz(zone).format(format);
}

function updateProduct(url, obj, node, tag, callback) {
	try {
		var newUrl = url + 'variants/' + obj.id + '.json';
		var sku = '';
		if(obj.hasOwnProperty('sku')) {
			sku = obj.sku;
		}
		var postData = {
			variant : {
				id : obj.id,
				price : obj.price,
				sku : sku,
				inventory_quantity : obj.quantity
			}			
		};
		var args = {
			data : postData,
			headers : {
				Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + apiPassword),
				"Content-Type": 'application/json',
				Accept : 'application/json'
			}
		};
		setTimeout(function() {
			client.put(newUrl, args, function(data, res) {
				try {
					var status = parseInt(res.statusCode/100);
					if(status == 2) {
						if(tag.toLowerCase() == 'product') {
							var msg = "Product " + obj.name +' has been updated successfully in Shopify';
							post(data, node, msg);
						} else {
							var variants = data.product.variants[0];
							callback(variants.id);
						}					
					} else {
						if(data.hasOwnProperty("errors")) {						
							errMsg = data.errors;					
						}
						emitter.emit('error', errMsg, data, newUrl, node);
					}
				} catch(e) {
					emitter.emit('error',e.message, e.stack, newUrl, node);
				}
			}).on('error', function(err) {
				emitter.emit('error', errMsg, err, newUrl, node);
			});
		}, 5000);
	} catch(e) {
		emitter.emit('error',e.message, e.stack, "", node);
	}
}

function createProduct(url, obj, node, callback) {
	try {
		url += "products.json";	
		var sku = '';
		if(obj.hasOwnProperty('sku')) {
			sku = obj.sku;
		}
		var postData = {
			product : {
				title : obj.name,
				body_html : obj.description,
				variants : [{
					price : obj.price,
					sku : sku,
					inventory_management : "shopify",
					inventory_quantity : obj.quantity
				}]			
			}
		};
		var args = {
			data : postData,
			headers : {
				Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + apiPassword),
				"Content-Type": 'application/json',
				Accept : 'application/json'
			}
		};
		setTimeout(function() {
			client.post(url, args, function(data, res) {
				try {
					var status = parseInt(res.statusCode/100);
					if(status == 2) {
						if(typeof callback == 'undefined') {
							var msg = "Product " + obj.name +' has been created successfully in Shopify';
							post(data, node, msg);
						} else {
							var variants = data.product.variants[0];
							callback(variants.id);
						}					
					} else {
						if(data.hasOwnProperty("errors")) {						
							errMsg = data.errors;					
						}
						emitter.emit('error', errMsg, data, url, node);
					}
				} catch(e) {
					emitter.emit('error',e.message, e.stack, url, node);
				}
			}).on('error', function(err) {
				emitter.emit('error', errMsg, err, url, node);
			});
		}, 5000);
	} catch(e) {
		emitter.emit('error',e.message, e.stack, "", node);
	}
}

function getVariantsId(url, node) {
	try {
		var obj = node.reqData;		
		var items = obj.items;
		var length = items.length;
		async.forEach(items, function(item) {
			try {
				getProductId(url, item, 'order', function(id) {
					item.id = id;
					length--;
					if(length == 0) {
						createOrder(url, node);
					}
				});
			} catch(e) {
				emitter.emit('error', e.message, e.stack, "", node);
			}
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function createOrder(url, node) {
	try {
		var obj = node.reqData;
		var newUrl = url + "orders.json";
		var items = obj.items;		
		var lineArr = [];
		for(var i = 0; i < items.length; i++)		{
			var lineObj = {};
			var itemObj = items[i];
			lineObj.variant_id = itemObj.id;
			lineObj.quantity = itemObj.quantity;
			lineArr[i] = lineObj;
		}
		var postData = {
			order : {
				line_items : lineArr,
				customer : {
					first_name : obj.customerName,
					last_name : '-',
					email : obj.email
				},
				email : obj.email,				
				billing_address : {
					first_name : obj.billingAddress.name,
					last_name: '-',
					address1 : obj.billingAddress.street,
					phone : obj.billingAddress.phone,
					city : obj.billingAddress.city,
					province : obj.billingAddress.state,
					country : obj.billingAddress.country,
					zip : obj.billingAddress.zip
				},
				shipping_address : {
					first_name : obj.shippingAddress.name,
					address1 : obj.shippingAddress.street,
					phone : obj.shippingAddress.phone,
					city : obj.shippingAddress.city,
					province : obj.shippingAddress.state,
					country : obj.shippingAddress.country,
					zip : obj.shippingAddress.zip
				},
				financial_status : obj.status
			}
		};
		var args = {
			data : postData,
			headers : {
				Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + apiPassword),
				"Content-Type": 'application/json',
				Accept : 'application/json'
			}
		};
		setTimeout(function() {
			client.post(newUrl, args, function(data, res) {
				try {
					var status = parseInt(res.statusCode/100);
					if(status == 2) {
						var msg = 'Order for the customer with email ' + obj.email + ' has been created successfully in Shopify';
						post(data, node);
					} else {
						errMsg = data.errors;
						if(data.errors.hasOwnProperty("order")) {
							errMsg = data.errors.order;
						}
						emitter.emit('error', errMsg, data, newUrl, node);
					}
				} catch(e) {
					emitter.emit('error', e.message, e.stack, "", node);
				}
			}).on('error', function(err) {
				emitter.emit('error', errMsg, err, newUrl, node);
			});
		}, 5000);
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}
}

function run(node) {
	try {
		var nodeType = node.connector.type;		
		if(nodeType.toLowerCase() == "action") {
			postDataModel(node);		
		} else {
			getDataCount(node);			
		}
	} catch(e) {
		emitter.emit('error', e.message, e.stack, "", node);
	}	 	 	
}

function testApp(callback) {
	try {
		var url = "https://"+storeName+".myshopify.com/admin/customers.json";
		var args = {
			headers:{ Authorization : "Basic " + b64EncodeUnicode(apiKey + ":" + apiPassword) }
		};
		var result;
		client.get(url, args, function(data, res) {
			try {
				var statusCode = parseInt(res.statusCode/100);    	
				if( statusCode == 2 ){
					result = {
						status : 'success',
						response : data
					};
				} else {
					result = {
						status : 'error',
						response : data.errors
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

function post(resArr, node, message) {
	node.resData = resArr;
	emitter.emit("success", node, message);
}

function init(node) {
	try {
		var credentials = node.credentials;
		apiKey = credentials.apiKey;
		apiPassword = credentials.password;
		storeName = credentials.storeName;
		run(node);
	} catch(e) {
		emitter.emit('error',e.message, e.stack, "", node);
	}
}

function test(request, callback) {
	try {
		var credentials = request.credentials;
		apiKey = credentials.apiKey;
		apiPassword = credentials.password;
		storeName = credentials.storeName;
		testApp(callback);
	} catch(e) {
		callback({status:"error", response:e.stack});
	}
}

var Shopify = {
	init : init,
	test : test
};

module.exports = Shopify;
