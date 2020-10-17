import * as vscode from 'vscode';
import { XmlCompleteSettings, XmlSchemaPropertiesArray } from './types';
import XmlLinterProvider from './linterprovider';
import XmlCompletionItemProvider from './completionitemprovider';
import XmlFormatProvider from './formatprovider';
import XmlRangeFormatProvider from './rangeformatprovider';
import AutoCompletionProvider from './autocompletionprovider';
import XmlHoverProvider from './hoverprovider';
import XmlDefinitionProvider from './definitionprovider';
import XmlDefinitionContentProvider from './definitioncontentprovider';

export declare let globalSettings: XmlCompleteSettings;

export const languageId = 'xml';

export const schemaId = 'xml2xsd-definition-provider';

export function activate(context: vscode.ExtensionContext): void {

	console.debug(`Activate XmlComplete`);

	vscode.workspace.onDidChangeConfiguration(loadConfiguration, undefined, context.subscriptions);
	loadConfiguration();

	const schemaPropertiesArray = new XmlSchemaPropertiesArray();
	const completionitemprovider = vscode.languages.registerCompletionItemProvider(
		{ language: languageId, scheme: 'file' },
		new XmlCompletionItemProvider(context, schemaPropertiesArray));

	const formatprovider = vscode.languages.registerDocumentFormattingEditProvider(
		{ language: languageId, scheme: 'file' },
		new XmlFormatProvider(context, schemaPropertiesArray));

	const rangeformatprovider = vscode.languages.registerDocumentRangeFormattingEditProvider(
		{ language: languageId, scheme: 'file' },
		new XmlRangeFormatProvider(context, schemaPropertiesArray));

	const hoverprovider = vscode.languages.registerHoverProvider(
		{ language: languageId, scheme: 'file' },
		new XmlHoverProvider(context, schemaPropertiesArray));

	const definitionprovider = vscode.languages.registerDefinitionProvider(
			{ language: languageId, scheme: 'file' },
			new XmlDefinitionProvider(context, schemaPropertiesArray));

	const linterprovider = new XmlLinterProvider(context, schemaPropertiesArray);

	const autocompletionprovider = new AutoCompletionProvider(context, schemaPropertiesArray);

	const definitioncontentprovider = vscode.workspace.registerTextDocumentContentProvider(schemaId, new XmlDefinitionContentProvider(context, schemaPropertiesArray));

	context.subscriptions.push(
		completionitemprovider,
		formatprovider,
		rangeformatprovider,
		hoverprovider,
		definitionprovider,
		linterprovider,
		autocompletionprovider,
		definitioncontentprovider);
}

function loadConfiguration(): void {
	const section = vscode.workspace.getConfiguration('xmlComplete', null);
	globalSettings = new XmlCompleteSettings();
	globalSettings.schemaMapping = section.get('schemaMapping', []);
	globalSettings.formattingStyle = section.get('formattingStyle', "singleLineAttributes");
}

export function deactivate(): void {
	console.debug(`Deactivate XmlComplete`);
}
