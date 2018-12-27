import * as vscode from 'vscode';
import { IXmlSchemaProperties } from './extension';

export default class XmlCompletionItemProvider implements vscode.CompletionItemProvider {

	private schemaPropertiesArray: Array<IXmlSchemaProperties>;

	constructor(_context: vscode.ExtensionContext, schemaPropertiesArray: Array<IXmlSchemaProperties>) {
		this.schemaPropertiesArray = schemaPropertiesArray;
	}

	provideCompletionItems(textDocument: vscode.TextDocument, _position: vscode.Position, _token: vscode.CancellationToken, _context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
		let schemaProperties = this.schemaPropertiesArray.find(e => undefined !== e.fileUris.find(u => u.toString() === textDocument.uri.toString()));
		if (schemaProperties === undefined) {
			return [];
		}

		return schemaProperties.tagCollection.map(t => new vscode.CompletionItem(t.tag, vscode.CompletionItemKind.Snippet));
	}
}