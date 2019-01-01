import * as vscode from 'vscode';
import XmlLinterProvider from './linterprovider';
import XmlCompletionItemProvider from './completionitemprovider';
import XmlFormatProvider from './formatprovider';
import XmlRangeFormatProvider from './rangeformatprovider';
import { XmlCompleteSettings, XmlSchemaProperties } from './types';

export declare let globalSettings: XmlCompleteSettings;

export const languageId: string = 'xml';

export function activate(context: vscode.ExtensionContext) {

	vscode.workspace.onDidChangeConfiguration(loadConfiguration, undefined, context.subscriptions);
	loadConfiguration();

	const schemaPropertiesArray = new Array<XmlSchemaProperties>();
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
				{
					"xmlns": "https://github.com/avaloniaui",
					"xsdUri": "https://raw.githubusercontent.com/rogalmic/vscode-xml-complete/master/test/Avalonia/AvaloniaXamlSchema.xsd",
					"strict": false
				},
				{
					"xmlns": "http://schemas.microsoft.com/winfx/2006/xaml/presentation",
					"xsdUri": "https://raw.githubusercontent.com/rogalmic/vscode-xml-complete/master/test/Wpf/Wpf.xsd",
					"strict": false
				}
			])
	};
}

export function deactivate() { }
