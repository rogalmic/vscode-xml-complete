import * as vscode from 'vscode';

export default class XmlCompletionItemProvider implements vscode.CompletionItemProvider {

	private tagAttributes: Map<string, Array<string>>;

	constructor(private context: vscode.ExtensionContext, allowedTagAttributes: Map<string, Array<string>>) {
		this.tagAttributes = allowedTagAttributes;
	}

	provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {

		let result = Array
			.from(this.tagAttributes.keys())
			.map(e => new vscode.CompletionItem(e, vscode.CompletionItemKind.Snippet));

		return result;
	}
}