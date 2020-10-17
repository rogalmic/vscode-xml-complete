import * as vscode from 'vscode';
import { XmlSchemaPropertiesArray, CompletionString } from './types';
import XmlSimpleParser from './helpers/xmlsimpleparser';
import { schemaId } from './extension';

export default class XmlDefinitionProvider implements vscode.DefinitionProvider {

	constructor(protected extensionContext: vscode.ExtensionContext, protected schemaPropertiesArray: XmlSchemaPropertiesArray) {
	}

	async provideDefinition(textDocument: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Location[]> {
		const documentContent = textDocument.getText();
		const offset = textDocument.offsetAt(position);
		const scope = await XmlSimpleParser.getScopeForPosition(documentContent, offset);
		if (token.isCancellationRequested) return [];

		// https://github.com/microsoft/vscode/commits/master/src/vs/editor/common/model/wordHelper.ts
		const wordRange = textDocument.getWordRangeAtPosition(position, /(-?\d*\.\d\w*)|([^\`\~\!\@\#\$\%\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\<\>\/\?\s]+)/g);
		const word = textDocument.getText(wordRange);

		const noDefinitionUri = (e: string) => `data:text/plain;base64,${Buffer.from(`No definition found for '${e}'`).toString('base64')}`;

		const generateResult = (cs: CompletionString) => new vscode.Location(
			vscode.Uri.parse(`${schemaId}://${Buffer.from(cs.definitionUri || noDefinitionUri(word)).toString('hex')}`),
			new vscode.Position(cs.definitionLine || 0, cs.definitionColumn || 0)
		);

		switch (scope.context) {
			case "element":
				const tags = this.schemaPropertiesArray
					.flatMap(p => p.tagCollection.filter(t => t.tag.name === word));

				if (tags.length > 0) {
					return tags.map(t => generateResult(t.tag));
				}
			break;

			case "attribute":
					const atts = this.schemaPropertiesArray
						.flatMap(p =>
							p.tagCollection.flatMap(t => t.attributes.filter(a => a.name === word)));

					if (atts.length > 0) {
						return atts.map(a => generateResult(a));
					}
				break;
		}

		throw `Unable to get definition for phrase '${word}'.`;
	}
}