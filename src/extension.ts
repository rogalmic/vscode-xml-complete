// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import XmlLinterProvider from './linterprovider';
import XmlCompletionItemProvider from './completionitemprovider';

export function activate(context: vscode.ExtensionContext) {

	const allowedTagAttributes : Map<string, Array<string>> = new Map<string, Array<string>>();
	let completionitemprovider = vscode.languages.registerCompletionItemProvider({ language: 'xml', scheme: 'file' }, new XmlCompletionItemProvider(context, allowedTagAttributes), '<');
	let linterprovider = new XmlLinterProvider(context, allowedTagAttributes);
	
	context.subscriptions.push(completionitemprovider, linterprovider);
}

// this method is called when your extension is deactivated
export function deactivate() {}
