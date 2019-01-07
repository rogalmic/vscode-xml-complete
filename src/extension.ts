import * as vscode from 'vscode';
import XmlLinterProvider from './linterprovider';
import XmlCompletionItemProvider from './completionitemprovider';
import XmlFormatProvider from './formatprovider';
import XmlRangeFormatProvider from './rangeformatprovider';
import { XmlCompleteSettings, XmlSchemaPropertiesArray } from './types';

export declare let globalSettings: XmlCompleteSettings;

export const languageId: string = 'xml';

export function activate(context: vscode.ExtensionContext) {

	vscode.workspace.onDidChangeConfiguration(loadConfiguration, undefined, context.subscriptions);
	loadConfiguration();

	const schemaPropertiesArray = new XmlSchemaPropertiesArray();
	let completionitemprovider = vscode.languages.registerCompletionItemProvider(
		{ language: languageId, scheme: 'file' },
		new XmlCompletionItemProvider(context, schemaPropertiesArray));

	let formatprovider = vscode.languages.registerDocumentFormattingEditProvider(
		{ language: languageId, scheme: 'file' },
		new XmlFormatProvider(context, schemaPropertiesArray));

	let rangeformatprovider = vscode.languages.registerDocumentRangeFormattingEditProvider(
		{ language: languageId, scheme: 'file' },
		new XmlRangeFormatProvider(context, schemaPropertiesArray));

	let linterprovider = new XmlLinterProvider(context, schemaPropertiesArray);

	context.subscriptions.push(completionitemprovider, linterprovider, formatprovider, rangeformatprovider);
}

function loadConfiguration(): void {
	const section = vscode.workspace.getConfiguration('xmlComplete', null);
	globalSettings = <XmlCompleteSettings>{
		schemaMapping: section.get('schemaMapping',
			[
			])
	};
}

export function deactivate() { }
