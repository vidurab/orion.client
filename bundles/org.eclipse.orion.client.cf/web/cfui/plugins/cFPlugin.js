/*******************************************************************************
 * @license
 * Copyright (c) 2013 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/*global window document define setTimeout*/

define(["orion/xhr", "orion/Deferred", "orion/plugin", "orion/cfui/cFClient", "domReady!"],

function(xhr, Deferred, PluginProvider, CFClient) {

	var temp = document.createElement('a');
	var login = temp.href;
	
	var headers = {
		name: "Cloud Foundry",
		version: "1.0",
		description: "This plugin integrates with Cloud Foundry.",
		//login: login
	};


	var provider = new PluginProvider(headers);
	var cFService = new CFClient.CFService();

	// cf settings
	var apiUrl = "";
	var manageUrl = "";
	provider.registerService("orion.core.setting", null, {
		settings: [{
			pid: "org.eclipse.orion.client.cf.settings",
			name: "Settings",
			category: 'Cloud Foundry',
			properties: [{
				id: "org.eclipse.orion.client.cf.settings.apiurl",
				name: "API Url",
				type: "string",
				defaultValue: apiUrl
			}, {
				id: "org.eclipse.orion.client.cf.settings.manageurl",
				name: "ACE / Manage Url",
				type: "string",
				defaultValue: manageUrl
			}]
		}]
	});
	
	/////////////////////////////////////////////////////
	// add CF project deploy action
	/////////////////////////////////////////////////////
	
	provider.registerServiceProvider("orion.project.deploy", {
		deploy: function(item, projectMetadata, props){
			alert("Project shared!");
			return {
				Message: "OK",
				ToSave: {
					ConfigurationName: props.Name,
					Parameters: props,
					Url: props.url
				}
			};
		},
		
		_retryWithLogin: function(props, func) {
			var that = this;
			var deferred = new Deferred();
			
			if(props.user && props.password){
				cFService.login(props.Target.Url, props.user, props.password).then(
					function(result){
						func(props, deferred);
					}, function(error){
						error.Retry = {
							parameters: [{id: "user", type: "text", name: "User:"}, {id: "password", type: "password", name: "Password:"}],
							optionalParameters: [{id: "privateKey", type: "test", name: "Private Key:"}]
						};
						deferred.reject(error);
					}
				);
			} else {
				func(props, deferred);
			}
			
			return deferred;
		},

		getState: function(props) {
			return this._retryWithLogin(props, this._getState);
		},
		
		_getState: function(props, deferred) {
			if (props.Target && props.Name){
				cFService.getApp(props.Target, props.Name).then(
					function(result){
						var app = result;
						deferred.resolve({
							Running: app.running_instances > 0,
							Message: app.running_instances + " of " + app.instances + " instance(s) running"
						});
					}, function(error){
						if (error.HttpCode === 404){
							deferred.resolve({
								Running: false,
								Message: error.Message
							});
						} else if (error.JsonData && error.JsonData.error_code) {
							var err = error.JsonData;
							if (err.error_code === "CF-InvalidAuthToken"){
								error.Retry = {
									parameters: [{id: "user", type: "text", name: "User:"}, {id: "password", type: "password", name: "Password:"}],
									optionalParameters: [{id: "privateKey", type: "test", name: "Private Key:"}]
								};
							}
							deferred.reject(error);
						} else {
							deferred.reject(error);
						}
					}
				);
				return deferred;
			}
		},
		
		start: function(props) {
			return this._retryWithLogin(props, this._start);
		},
		
		_start: function(props) {
			if (props.Target && props.Name){
				var that = this;
				var deferred = new Deferred();
				cFService.startApp(props.Target, props.Name).then(
					function(result){
						var app = result.entity;
						deferred.resolve({
							Running: (app.state === "STARTED" ? true : false),
						});
					}, function(error){
						if (error.HttpCode === 404){
							deferred.resolve({
								Running: false,
								Message: error.Message
							});
						} else if (error.JsonData && error.JsonData.error_code) {
							var err = error.JsonData;
							if (err.error_code === "CF-InvalidAuthToken"){
								error.Retry = {
									parameters: [{id: "user", type: "text", name: "User:"}, {id: "password", type: "password", name: "Password:"}],
									optionalParameters: [{id: "privateKey", type: "test", name: "Private Key:"}]
								};
							}
							deferred.reject(error);
						} else {
							deferred.reject(error);
						}
					}
				);
				return deferred;
			}
		},
		
		stop: function(props) {
			return this._retryWithLogin(props, this._stop);
		},
		
		_stop: function (props) {
			if (props.Target && props.Name){
				var that = this;
				var deferred = new Deferred();
				cFService.stopApp(props.Target, props.Name).then(
					function(result){
						var app = result.entity;
						deferred.resolve({
							Running: (app.state === "STOPPED" ? false : true),
						});
					}, function(error){
						if (error.HttpCode === 404){
							deferred.resolve({
								Running: false,
								Message: error.Message
							});
						} else if (error.JsonData && error.JsonData.error_code) {
							var err = error.JsonData;
							if (err.error_code === "CF-InvalidAuthToken"){
								error.Retry = {
									parameters: [{id: "user", type: "text", name: "User:"}, {id: "password", type: "password", name: "Password:"}],
									optionalParameters: [{id: "privateKey", type: "test", name: "Private Key:"}]
								};
							}
							deferred.reject(error);
						} else {
							deferred.reject(error);
						}
					}
				);
				return deferred;
			}
		}
	}, {
		name: "Deploy to Cloud Foundry",
		id: "org.eclipse.orion.client.cf.deploy",
		tooltip: "Deploy application in cloud.",
		validationProperties: [{source: "NoShow" }]
	});
	
	/////////////////////////////////////////////////////
	// add CF shell commands
	/////////////////////////////////////////////////////

	/** Register parent cf root command **/
	provider.registerServiceProvider(
		"orion.shell.command", null, {
		name: "cfo",
		description: "Commands for interacting with a Cloud Foundry compatible target"
	});
	
	/** Add cf target command **/
	var targetImpl = {
		callback: function(args) {
			if (args.url) {
				return cFService.setTarget(args.url).then(function(result) {
					if (result) {
						return "target: " + result.Url;
					} else {
						return "Target not set";
					}
				});
			} else {
				return cFService.getTarget().then(function(result) {
					return "target: " + result.Url;
				});
			}
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		targetImpl, {
			name: "cfo target",
			description: "Set or display the target cloud, organization, and space",
			parameters: [{
				name: "url",
				type: "string",
				description: "Target URL to switch to",
				defaultValue: null
			}, {
				name: "organization",
				type: "string",
				description: "Organization",
				defaultValue: null
			}, {
				name: "space",
				type: "string",
				description: "Space",
				defaultValue: null
			}]
		}
	);
	
	/** Add cf info command **/
	var infoImpl = {
		callback: function(args) {
			return cFService.getInfo().then(function(result) {
				var value = result.description + 
					"\nversion: " + result.version +
					"\nsupport: " + result.support;
				
				if (result.user) {
					value += "\n\nuser: " + result.user;
				}
				
				return value;
			});
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		infoImpl, {
			name: "cfo info",
			description: "Display information on the current target, user, etc."
		}
	);
	
	/** Add cf login command **/
	var loginImpl = {
		callback: function(args) {
			return cFService.login(null, args.username, args.password,
				args.org, args.space).then(function(result) {
					return "Logged in";
				}
			);
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		loginImpl, {
			name: "cfo login",
			description: "Log user in",
			parameters: [{
				name: "username",
				type: "string",
				description: "Username",
				defaultValue: null
			}, {
				name: "password",
				type: "string",
				description: "Password",
				defaultValue: null
			}, {
				name: "org",
				type: "string",
				description: "Organization",
				defaultValue: null
			}, {
				name: "space",
				type: "string",
				description: "Space",
				defaultValue: null
			}]
		}
	);

	/** Add cf logout command **/
	var logoutImpl = {
		callback: function(args) {
			return cFService.logout().then(function(result) {
				return "Logged out";
			});
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		logoutImpl, {
			name: "cfo logout",
			description: "Log user out"
		}
	);
	
	/** Add cf apps command **/
	function describeApp(app) {
		var name = app.name;
		var strResult = "\n" + name + "\t";
		if (name.length <= 4) {
			strResult += "\t";
		}
		strResult += app.state + "\t";
		var runningInstances = app.runningInstances;
		if (!runningInstances) {
			runningInstances = 0;
		}
		var mem = app.memory;
		strResult += runningInstances + " x " + mem + "M\t";
		var url = app.urls[0];
		strResult += "\t[" + url + "](http://" + url + ")";
		return strResult;
	}
	
	var appsImpl = {
		callback: function(args) {
			return cFService.getApps().then(function(result) {
				result = result.apps;
				
				if (!result || result.length === 0) {
					return "No applications.";
				}
				var strResult = "\nname\tstate\tinstances\tmemory\tdisk\turls\n";
				result.forEach(function(app) {
					strResult += describeApp(app);
				});
				return strResult;
			});
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		appsImpl, {
			name: "cfo apps",
			description: "List all apps in the target space"
		}
	);

	/** Add cf app command **/
	function describeAppVerbose(app) {
		var name = app.name;
		var strResult = "\n" + name + ": ";
		var runningInstances = app.runningInstances;
		var instances = app.instances;
		if (!runningInstances) {
			runningInstances = 0;
		}
		var percentage = runningInstances / instances * 100;
		strResult += percentage + "%\n\tplatform: ";
		strResult += "\n\tusage: " + app.memory + "M x ";
		strResult += runningInstances + " instance(s)";
		strResult += "\n\turls:";
		
		if (app.urls)
			app.urls.forEach(function(url) {
				strResult += "\n\t\t[" + url + "](http://" + url + ")";
			});
		/**if (app.services && app.services.length > 0) {
			strResult += "\n\tservices:";
			app.services.forEach(function(service) {
				strResult += "\n\t\t" + service;
			});
		}**/
		return strResult;
	}
	
	var appImpl = {
		callback: function(args, context) {
			return cFService.getApp(null, args.app, context.cwd).then(function(result) {
				if (!result) {
					return "Application not found";
				}
				return describeAppVerbose(result);
			});
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		appImpl, {
			name: "cfo app",
			description: "Display health and status for app",
			parameters: [{
				name: "app",
				type: "string",
				description: "Application to show information for",
				defaultValue: null
			}]
		}
	);
	
	/** Add cf push command **/
	var pushImpl = {
		callback: function(args, context) {
			return cFService.pushApp(args.app, context.cwd).then(function(result) {
				if (!result || !result.applications) {
					return "Application not found";
				}
				var strResult = "";
				result.applications.forEach(function(item) {
					var uri = item.uris[0];
					strResult += "\nApplication " + item.name + " ready at: [" + uri + "](http://" + uri + ")";
				});
				return strResult;
			});
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		pushImpl, {
			name: "cfo push",
			description: "Push a new app or sync changes to an existing app",
			parameters: [{
				name: "app",
				type: "string",
				description: "Application to push",
				defaultValue: null
			}]
		}
	);
	
	/** Add cf start command **/
	var startImpl = {
		callback: function(args, context) {
			return cFService.startApp(null, args.app, context.cwd).then(function(result) {
				if (!result || !result.entity) {
					return "Application not found";
				}
				var app = result.entity;
				if (app.state === "STARTED"){
					return "Application " + app.name + " started";
				} else {
					return "Problems while starting application " + app.name;
				}
			});
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		startImpl, {
			name: "cfo start",
			description: "Start an application",
			parameters: [{
				name: "app",
				type: "string",
				description: "Application to start",
				defaultValue: null
			}]
		}
	);

	/** Add cf stop command **/
	var stopImpl = {
		callback: function(args, context) {
			return cFService.stopApp(null, args.app, context.cwd).then(function(result) {
				if (!result || !result.entity) {
					return "Application not found";
				}
				var app = result.entity;
				if (app.state === "STOPPED"){
					return "Application " + app.name + " stopped";
				} else {
					return "Problems while stopping application " + app.name;
				}
			});
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		stopImpl, {
			name: "cfo stop",
			description: "Stop an application",
			parameters: [{
				name: "app",
				type: "string",
				description: "Application to stop",
				defaultValue: null
			}]
		}
	);
	
	/** Add cf delete command **/
	/** var deleteImpl = {
		callback: function(args, context) {
			return cFService.deleteApp(args.app, context.cwd).then(function(result) {
				if (!result || !result.applications) {
					return "No applications found";
				}
				var strResult = "";
				result.applications.forEach(function(item) {
					strResult += "\nDeleted " + item.name;
				});
				return strResult;
			});
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		deleteImpl, {
			name: "cfo delete",
			description: "Delete an application",
			parameters: [{
				name: "app",
				type: "string",
				description: "Application to delete",
				defaultValue: null
			}]
		}
	); **/

	provider.connect();
});