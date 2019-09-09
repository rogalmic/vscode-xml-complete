import * as vscode from 'vscode';
import { XmlSchemaPropertiesArray } from './types';
import XsdLoader from './helpers/xsdloader';

export default class XmlDefinitionContentProvider implements vscode.TextDocumentContentProvider {

	constructor(protected extensionContext: vscode.ExtensionContext, protected schemaPropertiesArray: XmlSchemaPropertiesArray) {
	}

	async provideTextDocumentContent (uri : vscode.Uri) : Promise<string> {
		// NOTE: Uri@Windows is normalizing to lower-case (https://vshaxe.github.io/vscode-extern/vscode/Uri.html), using hex
		let trueUri = Buffer.from(uri.toString(true).replace('xml2xsd-definition-provider://', ''), 'hex').toString();
        return await XsdLoader.loadSchemaContentsFromUri(trueUri);
    }
}