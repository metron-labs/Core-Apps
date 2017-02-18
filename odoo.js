var odooApp = require('odoo');
var async = require('async');

var emitter = require('../core-integration-server-v2/javascripts/emitter');

var userName, password, dbName, url, model, actionName, count, offset;
var finalDataArr = [];
var errMsg = '"Connection timeout error" in Odoo';

function run(node) {
	try {
		var nodeType = node.connector.type.toLowerCase();
		var type = node.option.toLowerCase();
		actionName = node.connection.actionName.toLowerCase();
		var opts = new odooApp({
			host: url,
			database: dbName,
			username: userName,
			password: password
		});
		var odoo = new odooApp(opts);
		if(nodeType == 'trigger') {
			getDataCount(odoo, type, node);
		} else {
			postOdooObjects(odoo, type, node);
		}
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function getDataCount(odoo, type, node) {
	try {
		if(type == "product") {
			model = "product.product";
		} else if (type == "repair order") {
			model = "mrp.repair";
		} else {
			model = 'sale.order';
		}		
		odoo.connect(function (err, res) {
			try {
				if (err) {
					if(err.hasOwnProperty('data')) {
						errMsg = err.data.message;
					}
					emitter.emit('error', errMsg, '', model, node);
					return;
				}			
				var params = {
					domain : [['id','>', '0']]
				};			
				odoo.search(model, params, function (err, result) {
					try {
						if (err) { 
							if(err.hasOwnProperty('data')) {
								errMsg = err.data.message;
							}
							emitter.emit('error', errMsg, '', model, node);
							return;
						} else {
							count = result.length;
							if(count == 0) {
								emitter.emit('error', 'No ' + type + 's found in Odoo', '', model, node);
								return;
							}
							if(type == "product") {
								getOdooProducts(odoo, node);
							} else {
								getOdooOrders(odoo, type, node);
							}
						}
					} catch(e) {
						emitter.emit('error', e.message, e.stack, '', node);
					}
				});	
			} catch(e) {
				emitter.emit('error', e.message, e.stack, '', node);
			}
		});	
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function getOdooProducts(odoo, node) {
	try {
		model = "product.product";
		odoo.connect(function (err, res) {
			try {
				if (err) {
					if(err.hasOwnProperty('data')) {
						errMsg = err.data.message;
					}
					emitter.emit('error', errMsg, '', model, node);
					return;
				}
				offset = finalDataArr.length;
				var params = {
					offset : offset,
					limit : 10
				};		
				odoo.browse_by_id(model, params, function (err, products) {
					try {
						if (err) { 
							if(err.hasOwnProperty('data')) {
								errMsg = err.data.message;
							}
							emitter.emit('error', errMsg, '', model, node);
							return;
						} else {
							setProducts(products, odoo, node);
						}
					} catch(e) {
						emitter.emit('error', e.message, e.stack, '', node);
					}
				});	
			} catch(e) {
				emitter.emit('error', e.message, e.stack, '', node);
			}
		});	
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function setProducts(productsArr, odoo, node) {
	try {
		var resArr = [];
		var resObj, prodObj;
		for(var i = 0; i < productsArr.length; i++) {
			prodObj = productsArr[i];
			resObj = {};
			resObj.id = prodObj.id;
			resObj.price = prodObj.list_price;
			resObj.name = prodObj.name;
			resObj.createdAt = prodObj.create_date;
			resObj.updatedAt = prodObj.__last_update;
			resObj.qty = prodObj.qty_available;
			resObj.sku = prodObj.id;
			resObj.weight = prodObj.weight;
			resObj.description = prodObj.description_sale;
			resObj.isLast = false;
			resObj.slackFlag = false;
			var length = finalDataArr.length + i;
			if(length == count-1) {
				resObj.isLast = true;
				if(actionName == 'slack') {
					resObj.slackFlag = true;
				}
			}			
			resArr[i] = resObj;
			if(i == productsArr.length-1) {
				post(resArr, node, '');
				finalDataArr = finalDataArr.concat(resArr);
				if(finalDataArr.length != count) {
					getOdooProducts(odoo, node);
				}
			}
		}		
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function getOdooOrders(odoo, type, node) {
	try {
		model = "sale.order";
		if (type == "repair order") {
			model = "mrp.repair";
		}
		odoo.connect(function (err, res) {
			try {
				if (err) { 
					if(err.hasOwnProperty('data')) {
						errMsg = err.data.message;
					}
					emitter.emit('error', errMsg, '', model, node);
					return; 
				}
				offset = finalDataArr.length;
				var params = {
					offset : offset,
					limit : 10
				};
				odoo.browse_by_id(model, params, function (err, orders) {
					try {
						if (err) { 
							if(err.hasOwnProperty('data')) {
								errMsg = err.data.message;
							}
							emitter.emit('error', errMsg, '', model, node);
							return;
						}
						setOrders(orders, odoo, type, node);
					} catch(e) {
						emitter.emit('error', e.message, e.stack, '', node);
					}
				});
			} catch(e) {
				emitter.emit('error', e.message, e.stack, '', node);
			}
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function setOrders(ordersArr, odoo, type, node) {
	try {
		model = "sale.order";
		var orderType = "SALE-ORDER:";
		if (type == "repair order") {
			model = "mrp.repair";
			orderType = "REPAIR-ORDER:";
		} 
		var obj, resObj;
		var resArr = [];
		for(var i = 0; i < ordersArr.length; i++) {
			resObj = {};
			obj = ordersArr[i];
			resObj.id = orderType + obj.id;
			var price = obj.amount_total.toString();
			if (price.length > 10) {
				price = price.substring(0, 9);
			}
			resObj.billingAddress = obj.partner_id[0];
			if( type == 'sale order') {
				resObj.shippingAddress = obj.partner_shipping_id[0];
				resObj.items = obj.order_line[0];
			} else {
				resObj.items = obj.operations[0];
			}
			resObj.price = price;
			resObj.name = obj.name;
			resObj.createdAt = obj.create_date;
			resObj.updatedAt = obj.__last_update;
			resObj.slackFlag = false;
			resObj.isLast = false;
			resArr[i] = resObj;
		}
		getAddress(resArr, odoo, type, node);
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function getAddress(ordersArr, odoo, type, node) {
	try {		
		var length = ordersArr.length;
		async.forEach(ordersArr, function(obj) {
			getResult(obj.billingAddress, 'res.partner', odoo, node, function(billingPartner) {
				obj.email = billingPartner[0].email;
				var billAddr = {};
				billAddr.name = billingPartner[0].name;
				billAddr.street = billingPartner[0].street;
				billAddr.city = billingPartner[0].city;
				billAddr.zip = billingPartner[0].zip;
				billAddr.phone = billingPartner[0].mobile;
				if(!(billingPartner[0].state_id instanceof Boolean)) {
					billAddr.state = billingPartner[0].state_id[1];
				}
				if(!(billingPartner[0].company_id instanceof Boolean)) {
					billAddr.company = billingPartner[0].company_id[1];
				} 
				if(!(billingPartner[0].country_id instanceof Boolean)) {
					billAddr.country = billingPartner[0].country_id[1];
					billAddr.countryCode = billingPartner[0].country_id[1];
				} 
				obj.billingAddress = billAddr;
				if(type == 'repair order') {
					obj.shippingAddress = billAddr;
				}
				length--;
				if(length == 0) {
					if(type == 'repair order') {
						getOrderLines(ordersArr, odoo, type, node);
					} else {
						getShippingAddress(ordersArr, odoo, type, node);
					}
				}
			});
		}, function(error) {
			emitter.emit('error',errMsg, '', '', node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function getShippingAddress(ordersArr, odoo, type, node) {
	try {
		var length = ordersArr.length;
		async.forEach(ordersArr, function(obj) {
			getResult(obj.shippingAddress, 'res.partner', odoo, node, function(shippingPartner) {
				obj.email = shippingPartner[0].email;
				var shippAddr = {};
				shippAddr.name = shippingPartner[0].name;
				shippAddr.street = shippingPartner[0].street;
				shippAddr.city = shippingPartner[0].city;
				shippAddr.zip = shippingPartner[0].zip;
				shippAddr.phone = shippingPartner[0].mobile;
				if(!(shippingPartner[0].state_id instanceof Boolean)) {
					shippAddr.state = shippingPartner[0].state_id[1];
				}
				if(!(shippingPartner[0].company_id instanceof Boolean)) {
					shippAddr.company = shippingPartner[0].company_id[1];
				} 
				if(!(shippingPartner[0].country_id instanceof Boolean)) {
					shippAddr.country = shippingPartner[0].country_id[1];
					shippAddr.countryCode = shippingPartner[0].country_id[1];
				} 
				obj.shippingAddress = shippAddr;
				length--;
				if(length == 0) {
					getOrderLines(ordersArr, odoo, type, node);
				}
			});
		}, function(error) {
			emitter.emit('error',errMsg, '', '', node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function getOrderLines(ordersArr, odoo, type, node) {
	try {
		var length = ordersArr.length;
		model = 'sale.order.line';
		if(type == 'repair order') {
			model = 'mrp.repair.line';
		}
		async.forEach(ordersArr, function(obj) {
			getResult(obj.items,  'sale.order.line', odoo, node, function(saleOrder) {
				var items = [];
				var item, itemObj;
				length--;
				for(var i = 0; i < saleOrder.length; i++) {
					item = {};
					itemObj = saleOrder[i];
					item.id = itemObj.product_id[0];
					item.name = itemObj.product_id[1];
					item.price = itemObj.price_unit;
					var qty = parseInt(itemObj.product_uom_qty);
					item.quantity = qty;
					items[i] = item;
				}
				obj.items = items;
				if(length == 0) {
					obj.isLast = true;
					if(actionName == 'slack') {
						obj.slackFlag = true;
					}
					post(resArr, node, '');
					finalDataArr = finalDataArr.concat(resArr);
					if(finalDataArr.length != count) {
						getOdooOrders(odoo, node);
					}
				}
			});
		}, function(error) {
			emitter.emit('error',errMsg, '', '', node);
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function getResult(id, model, odoo, node, callback) {
	try {
		odoo.connect(function (err, res) {
			try {
				if (err) { 
					if(err.hasOwnProperty('data')) {
						errMsg = err.data.message;
					}
					emitter.emit('error', errMsg, '', model, node);
					return;  
				}
				var params = {
					ids : id
				};
				odoo.get(model, params, function (err, data) {
					try {
						if (err) { 
							if(err.hasOwnProperty('data')) {
								errMsg = err.data.message;
							}
							emitter.emit('error', errMsg, '', model, node);
							return; 
						}
						callback(data);
					} catch(e) {
						emitter.emit('error', e.message, e.stack, '', node);
					}
				});
			} catch(e) {
				emitter.emit('error', e.message, e.stack, '', node);
			}
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function postOdooObjects(odoo, type, node) {
	try {
		var operation = node.optionType.toLowerCase();
		if(type == 'customer' && operation == 'create') {
			createCustomer(odoo, type, node);
		} else if(type == 'customer' && operation == 'update') {
			updatePartner(odoo, type, node);
		} else  if (type == "product" && operation == "create") {
			createItem(odoo, type, node);
		} else if(type == "sale order" && operation == 'create') {
			createSaleOrder(odoo, type, node);
		} else if(type == "invoice" && operation == "create") {
			createInvoice(odoo, type, node);
		}  
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function createCustomer(odoo, type, node) {
	try {
		var reqObj = node.reqData;
		getPartnerId(odoo, type, node, function (id){
			var msg = 'Customer with email address ' + reqObj.email + ' has been created successfully in Odoo with the id ' + id;
			post(id, node, msg);
		}); 
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function createPartner(odoo, type, node, callback) {
	try {
		var reqObj = node.reqData;
		odoo.connect(function (err, res) {
			try {
				if (err) { 
					if(err.hasOwnProperty('data')) {
						errMsg = err.data.message;
					}
					emitter.emit('error', errMsg, '', model, node);
					return;  
				}
				var addr;
				if(reqObj.hasOwnProperty('shippingAddress')) {
					addr = reqObj.shippingAddress;
				} else {
					addr = reqObj.defaultAddress;
					addr.name = reqObj.firstName;
				}
				getCountryId(odoo, addr.country, node, function(id) {
					var params = {
						email : reqObj.email,
						name  : addr.name,
						street : addr.street,
						city  :  addr.city,
						mobile : addr.phone,
						state  : addr.state,
						zip    :  addr.zip,
						country_id : id
					};
					model = 'res.partner';
					odoo.create(model, params, function (err, partnerId) {
						try {
							if (err) {
								if(err.hasOwnProperty('data')) {
									errMsg = err.data.arguments[0];
								}
								emitter.emit('error', errMsg, '', model, node);
								return;  
							} else {
								callback(partnerId);
							}
						} catch(e) {
							emitter.emit('error', e.message, e.stack, '', node);
						}
					});
				});
			} catch(e) {
				emitter.emit('error', e.message, e.stack, '', node);
			}
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function getCountryId(odoo, name, node, callback) {
	try {		
		model = 'res.country';
		odoo.connect(function (err, res) {
			try { 
				if (err) { 
					if(err.hasOwnProperty('data')) {
						errMsg = err.data.message;
					}
					emitter.emit('error', errMsg, '', model, node);
					return; 
				}
				var params;
				if(name.length < 3) {
					params = {
						domain : [['code','=', name]]
					}; 
				} else {
					params = {
						domain : [['name','=', name]]
					}; 
				}
				odoo.search('res.country', params, function (err, country) {
					try {
						if (err) { 
							if(err.hasOwnProperty('data')) {
								errMsg = err.data.arguments[0];
							}
							emitter.emit('error', errMsg, '', model, node);
							return; 
						} else {
							callback(country[0]);
						}
					} catch(e) {
						emitter.emit('error', e.message, e.stack, '', node);
					}
				});
			} catch(e) {
				emitter.emit('error', e.message, e.stack, '', node);
			}
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function getPartnerId(odoo, type, node, callback) {
	try {
		var reqObj = node.reqData;
		odoo.connect(function (err, res) {
			try { 
				if (err) { 
					if(err.hasOwnProperty('data')) {
						errMsg = err.data.message;
					}
					emitter.emit('error', errMsg, '', model, node);
					return; 
				}
				var params = {
					domain : [['email','=', reqObj.email]]
				}
				model = 'res.partner';
				odoo.search(model, params, function (err, partner) {
					try {
						if (err) { 
							if(err.hasOwnProperty('data')) {
								errMsg = err.data.arguments[0];
							}
							emitter.emit('error', errMsg, '', model, node);
							return; 
						} else {
							if(partner.length == 0) {
								createPartner(odoo, type, node, function(partnerId) {
									callback(partnerId);
								});
							} else {
								callback(partner[0]);
							}
						}
					} catch(e) {
						emitter.emit('error', e.message, e.stack, '', node);
					}
				});
			} catch(e) {
				emitter.emit('error', e.message, e.stack, '', node);
			}
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function updatePartner(odoo, type, node, callback) {
	try {
		var reqObj = node.reqData;
		odoo.connect(function (err, res) {
			try {
				if (err) { 
					if(err.hasOwnProperty('data')) {
						errMsg = err.data.message;
					}
					emitter.emit('error', errMsg, '', model, node);
					return;  
				}
				var addr;
				if(reqObj.hasOwnProperty('shippingAddress')) {
					addr = reqObj.shippingAddress;
				} else {
					addr = reqObj.defaultAddress;
					addr.name = reqObj.firstName;
				}
				getPartnerId(odoo, type, node, function(partnerId) {
					getCountryId(odoo, addr.country, node, function(id) {
						var params = {
							name  : addr.name,
							street : addr.street,
							city  :  addr.city,
							mobile : addr.phone,
							state  : addr.state,
							zip    :  addr.zip,
							country_id : id
						};
						model = 'res.partner';
						odoo.update(model, partnerId, params, function (err, partner) {
							try { 
								if (err) {
									if(err.hasOwnProperty('data')) {
										errMsg = err.data.arguments[0];
									}
									emitter.emit('error', errMsg, '', model, node);
									return;  
								} else {
									var msg = 'Customer with email address ' + reqObj.email + ' has been updated successfully in Odoo';
									post(partner, node, msg);
								}
							} catch(e) {
								emitter.emit('error', e.message, e.stack, '', node);
							}
						});
					});
				});
			} catch(e) {
				emitter.emit('error', e.message, e.stack, '', node);
			}
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function createItem(odoo, type, node) {
	try {
		var reqObj = node.reqData;
		getProductId(reqObj, odoo, type, node, function (id){
			var msg = 'Product ' + reqObj.name + ' has been created successfully in Odoo with the id ' + id;
			post(id, node, msg);
		}); 
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function getProductId(prodObj, odoo, type, node,  callback) {
	try {
		model ='product.product';
		odoo.connect(function (err, res) {
			try {
				if (err) { 
					if(err.hasOwnProperty('data')) {
						errMsg = err.data.message;
					}
					emitter.emit('error', errMsg, '', model, node);
					return;   
				}
				var params = {
					domain : [['name','=', prodObj.name]]
				}; 
				odoo.search(model, params, function (err, product) {
					try {
						if (err) { 
							if(err.hasOwnProperty('data')) {
								errMsg = err.data.message;
							}
							emitter.emit('error', errMsg, '', model, node);
							return;  
						} else {
							if(product.length == 0) {
								createProduct(odoo, prodObj, type, node, function(productId) {
									callback(productId);
								});
							} else {
								callback(product[0]);
							}
						}
					} catch(e) {
						emitter.emit('error', e.message, e.stack, '', node);
					}
				});
			} catch(e) {
				emitter.emit('error', e.message, e.stack, '', node);
			}
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function createProduct(odoo, obj, type, node, callback) {
	try {
		odoo.connect(function (err, res) {
			try {
				if (err) { 
					if(err.hasOwnProperty('data')) {
						errMsg = err.data.message;
					}
					emitter.emit('error', errMsg, '', model, node);
					return;  
				}
				var params = {
					name: obj.name,
					list_price : obj.price
				}; 
				model = 'product.product';
				odoo.create(model, params, function (err, productId) {
					try { 
						if (err) { 
							if(err.hasOwnProperty('data')) {
								errMsg = err.data.message;
							}
							if(err.hasOwnProperty('data')) {
								errMsg = err.data.arguments[0];
							}
							emitter.emit('error', errMsg, '', model, node);
							return;  
						} else {
							callback(productId);
						}
					} catch(e) {
						emitter.emit('error', e.message, e.stack, '', node);
					}
				});
			} catch(e) {
				emitter.emit('error', e.message, e.stack, '', node);
			}
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function createSaleOrder(odoo, type, node) {
	try {
		var reqObj = node.reqData;
		odoo.connect(function (err, res) {
			try {
				if (err) { 
					if(err.hasOwnProperty('data')) {
						errMsg = err.data.message;
					}
					emitter.emit('error', errMsg, '', model, node);
					return; 
				}
				getPartnerId(odoo, type, node, function(partnerId) {
					var params = {
						partner_id : partnerId
					};
					model = 'sale.order';
					odoo.create(model, params, function (err, orderId) {
						try {
							if (err) { 
								if(err.hasOwnProperty('data')) {
									errMsg = err.data.message;
								}
								emitter.emit('error', errMsg, '', model, node);
								return; 
							} else {
								createOrderLines(odoo, type, orderId, node);
							}
						} catch(e) {
							emitter.emit('error', e.message, e.stack, '', node);
						}
					});
				});
			} catch(e) {
				emitter.emit('error', e.message, e.stack, '', node);
			}
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function createOrderLines(odoo, type, orderId, node) {
	try {
		var reqObj = node.reqData;
		var itemArr = reqObj.items;
		var length = itemArr.length;
		async.forEach(itemArr, function(itemObj) {
			odoo.connect(function (err, res) {
				try {
					if (err) { 
						if(err.hasOwnProperty('data')) {
							errMsg = err.data.message;
						}
						emitter.emit('error', errMsg, '', model, node);
						return; 
					}
					getProductId(itemObj, odoo, type, node, function(productId) {
						var params = {
							product_id : productId,
							order_id   : orderId,
							product_uom_qty : itemObj.quantity,
							qty_delivered : itemObj.quantity,
							qty_invoiced : itemObj.quantity,
							qty_to_invoice : itemObj.quantity
						};	
						model = 'sale.order.line';
						odoo.create(model, params, function (err, orders) {
							try {
								if (err) { 
									if(err.hasOwnProperty('data')) {
										errMsg = err.data.message;
									}
									emitter.emit('error', errMsg, '', model, node);
									return; 
								} else {
									length--;
									if(length == 0) {
										updateProducts(odoo, type, orderId, node);
									}
								}
							} catch(e) {
								emitter.emit('error', e.message, e.stack, '', node);
							}
						});
					});
				} catch(e) {
					emitter.emit('error', e.message, e.stack, '', node);
				}
			});
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function updateProducts(odoo, type, orderId, node) {
	try {
		var reqObj = node.reqData;
		var itemArr = reqObj.items;
		var length = itemArr.length;
		async.forEach(itemArr, function(itemObj) {
			odoo.connect(function (err, res) {
				try {
					if (err) { 
						if(err.hasOwnProperty('data')) {
							errMsg = err.data.message;
						}
						emitter.emit('error', errMsg, '', model, node);
						return; 
					}
					getProductId(itemObj, odoo, type, node, function(productId) {
						getResult(productId,'product.product', odoo, node, function(data) {
							var	qty = data.qty_available - itemObj.quantity;
							var params = {
								ids : productId,
								qty_available : qty
							};
							odoo.update('product.product', productId, params, function (err, data) {
								try {
									if (err) { 
										if(err.hasOwnProperty('data')) {
											errMsg = err.data.message;
										}
										emitter.emit('error', errMsg, '', model, node);
										return; 
									} else {
										length--;
										if(length == 0) {
											updateOrder(odoo, orderId, node);
										}
									}
								} catch(e) {
									emitter.emit('error', e.message, e.stack, '', node);
								}
							});
						});
					});
				} catch(e) {
					emitter.emit('error', e.message, e.stack, '', node);
				}
			});
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function updateOrder(odoo, orderId, node) {
	try {
		odoo.connect(function (err, res) {
			try {
				if (err) { 
					if(err.hasOwnProperty('data')) {
						errMsg = err.data.message;
					}
					emitter.emit('error', errMsg, '', model, node);
					return;  
				}
				var params = {
					ids : orderId,
					invoice_status : "to invoice",
					state   :  "sale"
				};
				model = 'sale.order';
				odoo.update(model, orderId, params, function (err, id) {
					try {
						if (err) { 
							if(err.hasOwnProperty('data')) {
								errMsg = err.data.message;
							}
							emitter.emit('error', errMsg, '', model, node);
							return; 
						} else {
							post(id, node, "Order " + orderId + " has been created successfully in Odoo");
						}
					} catch(e) {
						emitter.emit('error', e.message, e.stack, '', node);
					}
				});
			} catch(e) {
				emitter.emit('error', e.message, e.stack, '', node);
			}
		});
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

function post(response, node, message) {
	node.resData = response;
	emitter.emit('success', node, message);
}

function testApp(callback) {
	try {
		var opts = new odooApp({
			host: url,
			database: dbName,
			username: userName,
			password: password
		});
		var odoo = new odooApp(opts);
		odoo.connect(function (err, res) {
			try {
				var result;
				if (err) { 
					result = {
						status : 'error',
						response : err
					}; 
				} else {
					result = {
						status : 'success',
						response : res
					};
				}
				callback(result);
			} catch(e) {
				callback({status:'error', response: e.stack});
			}
		});
	} catch(e) {
		callback({status:'error', response: e.stack});
	}
}

function test(request, callback) {
	try {
		var credentials = request.credentials;
		userName = credentials.userName;
		password = credentials.password;
		dbName = credentials.dbName;
		url = credentials.url;
		testApp(callback);
	} catch(e) {
		callback({status : 'error', response : e.stack});
	}
}

function init(node) {
	try {
		var credentials = node.credentials;
		userName = credentials.userName;
		password = credentials.password;
		dbName = credentials.dbName;
		url = credentials.url;
		run(node);
	} catch(e) {
		emitter.emit('error', e.message, e.stack, '', node);
	}
}

var Odoo = {
	init : init,
	test : test
};

module.exports = Odoo;