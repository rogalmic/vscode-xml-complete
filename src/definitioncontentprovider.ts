import * as vscode from 'vscode';
import { XmlSchemaPropertiesArray } from './types';
import XsdCachedLoader from './helpers/xsdcachedloader';
import { schemaId } from './extension';

export default class XmlDefinitionContentProvider implements vscode.TextDocumentContentProvider {

    constructor(protected extensionContext: vscode.ExtensionContext, protected schemaPropertiesArray: XmlSchemaPropertiesArray) {
    }

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        // NOTE: Uri@Windows is normalizing to lower-case (https://vshaxe.github.io/vscode-extern/vscode/Uri.html), using hex
        const trueUri = Buffer.from(uri.toString(true).replace(`${schemaId}://`, ''), 'hex').toString();
        return (await XsdCachedLoader.loadSchemaContentsFromUri(trueUri)).data;
    }
}