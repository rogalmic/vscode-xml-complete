import * as vscode from 'vscode';
import XmlLinterProvider from './linterprovider';
import XmlCompletionItemProvider from './completionitemprovider';
import XmlFormatProvider from './formatprovider';
import XmlRangeFormatProvider from './rangeformatprovider';

export interface IXmlCompleteSettings {
    schemaMapping: {xmlns: string, xsdUri: string}[];
}

export declare let globalSettings: IXmlCompleteSettings;

export interface IXmlSchemaProperties {
	schemaUri: vscode.Uri;
	xsdContent: string;
	tagCollection: { tag: string, attributes : Array<string>}[];
}


export const languageId : string = 'xml';

export function activate(context: vscode.ExtensionContext) {

	vscode.workspace.onDidChangeConfiguration(loadConfiguration, undefined, context.subscriptions);
    loadConfiguration();

	const schemaPropertiesArray = new Array<IXmlSchemaProperties>();
	let completionitemprovider = vscode.languages.registerCompletionItemProvider({ language: languageId, scheme: 'file' }, new XmlCompletionItemProvider(context, schemaPropertiesArray));
	let formatprovider = vscode.languages.registerDocumentFormattingEditProvider({ language: languageId}, new XmlFormatProvider(context, schemaPropertiesArray));
	let rangeformatprovider = vscode.languages.registerDocumentRangeFormattingEditProvider({ language: languageId}, new XmlRangeFormatProvider(context, schemaPropertiesArray));
	let linterprovider = new XmlLinterProvider(context, schemaPropertiesArray);

	context.subscriptions.push(completionitemprovider, linterprovider, formatprovider, rangeformatprovider);
}

function loadConfiguration(): void {
	const section = vscode.workspace.getConfiguration('xmlComplete');
	globalSettings = <IXmlCompleteSettings>{
		schemaMapping: section.get('schemaMapping',
		[
            { "xmlns": "https://github.com/avaloniaui", "xsdUri": "https://raw.githubusercontent.com/rogalmic/vscode-xml-complete/master/test/Avalonia/AvaloniaXamlSchema.xsd"},
            { "xmlns": "http://www.w3.org/1999/xhtml", "xsdUri": "https://raw.githubusercontent.com/stefangrunert/XHTML5-XML-Schema/master/xhtml5.xsd"}
        ])
	};
}

export function deactivate() {}
