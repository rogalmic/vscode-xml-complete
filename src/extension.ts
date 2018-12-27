import * as vscode from 'vscode';
import XmlLinterProvider from './linterprovider';
import XmlCompletionItemProvider from './completionitemprovider';
import XmlFormatProvider from './formatprovider';
import XmlRangeFormatProvider from './rangeformatprovider';

export interface IXmlSchemaProperties {
	namespaceUri: vscode.Uri;
	fileUris: vscode.Uri[];
	tagCollection: { tag: string, attributes : Array<string>}[];
}

export const LanguageId : string = 'xml';

export function activate(context: vscode.ExtensionContext) {

	const schemaPropertiesArray = new Array<IXmlSchemaProperties>();
	let completionitemprovider = vscode.languages.registerCompletionItemProvider({ language: LanguageId, scheme: 'file' }, new XmlCompletionItemProvider(context, schemaPropertiesArray), '<');
	let formatprovider = vscode.languages.registerDocumentFormattingEditProvider({ language: LanguageId}, new XmlFormatProvider(context, schemaPropertiesArray));
	let rangeformatprovider = vscode.languages.registerDocumentRangeFormattingEditProvider({ language: LanguageId}, new XmlRangeFormatProvider(context, schemaPropertiesArray));
	let linterprovider = new XmlLinterProvider(context, schemaPropertiesArray);

	context.subscriptions.push(completionitemprovider, linterprovider, formatprovider, rangeformatprovider);
}

export function deactivate() {}
