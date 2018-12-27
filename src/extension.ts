import * as vscode from 'vscode';
import XmlLinterProvider from './linterprovider';
import XmlCompletionItemProvider from './completionitemprovider';

export interface IXmlSchemaProperties {
	namespaceUri: vscode.Uri;
	fileUris: vscode.Uri[];
	tagCollection: { tag: string, attributes : Array<string>}[];
}

export const LanguageId : string = 'xml';

export function activate(context: vscode.ExtensionContext) {

	const schemaPropertiesArray = new Array<IXmlSchemaProperties>();
	let completionitemprovider = vscode.languages.registerCompletionItemProvider({ language: LanguageId, scheme: 'file' }, new XmlCompletionItemProvider(context, schemaPropertiesArray), '<');
	let linterprovider = new XmlLinterProvider(context, schemaPropertiesArray);

	context.subscriptions.push(completionitemprovider, linterprovider);
}

export function deactivate() {}
