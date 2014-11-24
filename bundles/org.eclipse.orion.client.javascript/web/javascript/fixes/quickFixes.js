 /*******************************************************************************
 * @license
 * Copyright (c) 2014 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
/*eslint-env amd*/
/* global doctrine */
define([
'orion/objects',
'javascript/fixes/no-empty-block',
'javascript/fixes/no-extra-semi',
'javascript/fixes/no-fallthrough',
'javascript/fixes/no-undef-defined'
], function(Objects, no_empty_block, no_extra_semi, no_fallthrough, no_undef_defined) {
	
	/**
	 * @description Creates a new JavaScript quick fix computer
	 * @param {javascript.ASTManager} astManager The AST manager
	 * @returns {javascript.JavaScriptQuickfixes} The new quick fix computer instance
	 * @since 8.0
	 */
	function JavaScriptQuickfixes(astManager) {
	   this.astManager = astManager;
	}
	
	var fixMap = {
	    'no-empty-block': no_empty_block,
	    'no-extra-semi': no_extra_semi,
	    'no-fallthrough': no_fallthrough,
	    'no-undef-defined': no_undef_defined
	};
	
	Objects.mixin(JavaScriptQuickfixes.prototype, /** @lends javascript.JavaScriptQuickfixes.prototype*/ {
		/**
		 * @description Editor command callback
		 * @function
		 * @param {orion.edit.EditorContext} editorContext The editor context
		 * @param {Object} context The context params
		 */
		execute: function(editorContext, context) {
	        var fixes = fixMap[context.annotation.id];
	        if(fixes) {
	            return fixes(editorContext, context.annotation, this.astManager);
	        }
		    return null;
		}
	});
	
	JavaScriptQuickfixes.prototype.contructor = JavaScriptQuickfixes;
	
	return {
		JavaScriptQuickfixes: JavaScriptQuickfixes
		};
});