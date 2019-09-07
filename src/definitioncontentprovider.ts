import * as vscode from 'vscode';
import { XmlSchemaPropertiesArray } from './types';
import XsdLoader from './helpers/xsdloader';

export default class XmlDefinitionContentProvider implements vscode.TextDocumentContentProvider {

	constructor(protected extensionContext: vscode.ExtensionContext, protected schemaPropertiesArray: XmlSchemaPropertiesArray) {
	}

	async provideTextDocumentContent (uri : vscode.Uri) : Promise<string> {
		// NOTE: something wrong with Uri character casing in Windows
		let trueUri = decodeURIComponent(uri.toString(true).replace('xml2xsd-definition-provider://', ''));
        return await XsdLoader.loadSchemaContentsFromUri(trueUri);
    }
}