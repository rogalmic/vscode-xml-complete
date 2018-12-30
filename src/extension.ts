import * as vscode from 'vscode';
import XmlLinterProvider from './linterprovider';
import XmlCompletionItemProvider from './completionitemprovider';
import XmlFormatProvider from './formatprovider';
import XmlRangeFormatProvider from './rangeformatprovider';

export interface IXmlCompleteSettings {
	schemaMapping: { xmlns: string, xsdUri: string }[];
}

export interface IXmlTag {
	tag: string;
	base: string | undefined;
	attributes: Array<string>;
}

export class XmlTagCollection extends Array<IXmlTag> {
	loadAttributes(tagName: string | undefined): string[] {
		let result: string[] = [];
		if (tagName !== undefined) {
			var currentTags = this.filter(e => e.tag === tagName);
			if (currentTags.length > 0) {
				result.push(...currentTags.map(e => e.attributes).reduce((prev, next) => prev.concat(next)));
				currentTags.forEach(e => result.push(...this.loadAttributes(e.base)));
			}
		}
		return result;
	}
}

export interface IXmlSchemaProperties {
	schemaUri: vscode.Uri;
	xsdContent: string;
	tagCollection: XmlTagCollection;
}

export declare let globalSettings: IXmlCompleteSettings;

export const languageId: string = 'xml';

export function activate(context: vscode.ExtensionContext) {

	vscode.workspace.onDidChangeConfiguration(loadConfiguration, undefined, context.subscriptions);
	loadConfiguration();

	const schemaPropertiesArray = new Array<IXmlSchemaProperties>();
	let completionitemprovider = vscode.languages.registerCompletionItemProvider({ language: languageId, scheme: 'file' }, new XmlCompletionItemProvider(context, schemaPropertiesArray));
	let formatprovider = vscode.languages.registerDocumentFormattingEditProvider({ language: languageId }, new XmlFormatProvider(context, schemaPropertiesArray));
	let rangeformatprovider = vscode.languages.registerDocumentRangeFormattingEditProvider({ language: languageId }, new XmlRangeFormatProvider(context, schemaPropertiesArray));
	let linterprovider = new XmlLinterProvider(context, schemaPropertiesArray);

	context.subscriptions.push(completionitemprovider, linterprovider, formatprovider, rangeformatprovider);
}

function loadConfiguration(): void {
	const section = vscode.workspace.getConfiguration('xmlComplete');
	globalSettings = <IXmlCompleteSettings>{
		schemaMapping: section.get('schemaMapping',
			[
				{ "xmlns": "https://github.com/avaloniaui", "xsdUri": "https://raw.githubusercontent.com/rogalmic/vscode-xml-complete/master/test/Avalonia/AvaloniaXamlSchema.xsd" }
			])
	};
}

export function deactivate() { }
