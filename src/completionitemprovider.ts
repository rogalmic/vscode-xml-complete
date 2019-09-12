import { CompletionString, XsdType, CsType } from './types';
import { CompletionAdapterBase } from '../base/CompletionAdapterBase';
import XmlSimpleParser from './helpers/xmlsimpleparser';
import XsdSettings, { ISnippet } from './helpers/settings';

export class XmlCompletionItemProvider extends CompletionAdapterBase implements monaco.languages.CompletionItemProvider {

	public get triggerCharacters(): string[] {
		return ['<', ' ', '='];
	}

	async provideCompletionItems(textDocument: monaco.editor.ITextModel, position: monaco.Position, context: monaco.languages.CompletionContext, token: monaco.CancellationToken)
		: Promise<monaco.languages.CompletionList> {

		let documentContent = textDocument.getValue();

		let xsdFileUris = (await XmlSimpleParser.getSchemaXsdUris(documentContent,
			XsdSettings.schemaMapping.filter(sm => !sm.noComplete))).map(u => monaco.Uri.parse(u));
		await XsdSettings.prepare(xsdFileUris);

		let localNsMap = await XmlSimpleParser.getNamespaceMapping(documentContent);
		let scope = await XmlSimpleParser.getScopeForPosition(documentContent, textDocument.getOffsetAt(position));

		let resultTexts: CompletionString[];
		let addTagSnippet = false, addAttribSnippet = false;

		const schemaProperties = XsdSettings.schemaPropertiesArray.filterUris(xsdFileUris);
		const parentTagName = scope.parentTagName ? scope.parentTagName.substring(scope.parentTagName.indexOf(":") + 1) : null;

		let addSnippets: ISnippet[] = [];

		function addRootSnippet() {
			XsdSettings.schemaMapping.forEach(sm => {
				if (sm.rootSnippets) {
					addSnippets = addSnippets.concat(sm.rootSnippets);
				}
			});
		}

		if (token.isCancellationRequested) {
			resultTexts = [];
		}
		else if (scope.context === "text") {
			resultTexts = [];
			addTagSnippet = true;
		}
		else if (scope.tagName === undefined) {
			resultTexts = [];
			addRootSnippet();
			addTagSnippet = true;
		}
		else if (scope.context === "element" /*&& scope.tagName.indexOf(".") < 0*/) {
			const parentTag = schemaProperties
				.map(sp => sp.tagCollection
					.filter(e => e.visible && e.tag.name === parentTagName))
				.reduce((prev, next) => prev.concat(next), [])[0];

			resultTexts = schemaProperties
				.map(sp => sp.tagCollection.loadTagEx(parentTag ? parentTag.tag.name : null, localNsMap)
					.map(tag => sp.tagCollection.fixNs(tag, localNsMap, sp)))
				.reduce((prev, next) => prev.concat(next), [])
				.sort()
				.filter((v, i, a) => a.findIndex(e => e.name === v.name && e.comment === v.comment) === i);

			if (parentTag) {
				let arr = scope.parentTagName.split(":");
				const schema = XsdSettings.schemaMapping.filter(sm => sm.xmlns === (arr.length === 2 ? localNsMap.nsToUri.get(arr[0]) : localNsMap.nsToUri.get("")))[0];
				if (schema && schema.snippets) {
					addSnippets = schema.snippets.filter(s => !s.parentTags || s.parentTags.indexOf(parentTagName) > -1);
				}
			}
			else if (!scope.parentTagName) {
				addRootSnippet();
			}
		}
		else if (scope.context === "attribute" && scope.tagName) {
			let p: number;
			const parentTagNs = scope.tagName && (p = scope.tagName.indexOf(":")) > -1 ? scope.tagName.substring(0, p) : null;

			resultTexts = schemaProperties
				.map(sp => sp.tagCollection.loadAttributesEx(scope.tagName /*? scope.tagName.replace(".", "") : undefined*/, localNsMap, sp.namespace)
					.map(attr => sp.tagCollection.fixNs(attr, localNsMap, sp, parentTagNs)))
				.reduce((prev, next) => prev.concat(next), [])
				.sort()
				.filter((v, i, a) => a.findIndex(e => e.name === v.name && e.comment === v.comment) === i);

			const isAttribValue = textDocument.getValueInRange(new monaco.Range(position.lineNumber, position.column - 1, position.lineNumber, position.column)) === "=";
			if (isAttribValue) {
				addAttribSnippet = true;
				const attribName = textDocument.getWordAtPosition(new monaco.Position(position.lineNumber, position.column - 3));
				if (attribName && attribName.word) {
					const attrib = resultTexts.filter(r => r.name === attribName.word)[0];
					if (attrib && attrib.values) {
						addAttribSnippet = false;
						resultTexts = attrib.values;
					}
				}
				if (addAttribSnippet) {
					resultTexts = [];
				}
			}
		}
		else {
			resultTexts = [];
			addTagSnippet = true;
		}

		let complete: monaco.languages.CompletionList = {
			suggestions: resultTexts
				.map(t => {
					const ci: monaco.languages.CompletionItem = {
						kind: t.type === CsType.Element ? monaco.languages.CompletionItemKind.Class : monaco.languages.CompletionItemKind.Property,
						insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
						label: t.name,
						detail: t.comment,
						documentation: t.documentation,
						insertText: t.type === CsType.Element ? `${t.name}>$0</${t.name}>` :
							t.type === CsType.AttributeValue ? `"${t.name}" $0` : t.name,
						range: null
					};
					return ci;
				}),
			incomplete: false
		}

		if (addTagSnippet) {
			complete.suggestions.push(
				<monaco.languages.CompletionItem>{
					kind: monaco.languages.CompletionItemKind.Constructor,
					insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
					label: "quick tag",
					insertText: "<${1:name}>$0</${1:name}>",
					detail: "Inserts a full tag - press TAB to type content",
					sortText: " ", range: null
				});
		}
		else if (addAttribSnippet) {
			complete.suggestions.push(
				<monaco.languages.CompletionItem>{
					kind: monaco.languages.CompletionItemKind.Constructor,
					insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
					label: "attribute",
					insertText: `"$0"`,
					detail: "An empty attribute",
					sortText: " ", range: null
				});
		}

		if (addSnippets.length) {
			addSnippets.forEach(s => complete.suggestions.push(
				<monaco.languages.CompletionItem>{
					kind: monaco.languages.CompletionItemKind.Snippet,
					insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
					label: s.label,
					insertText: s.insertText,
					detail: s.detail,
					documentation: s.documentation,
					sortText: s.label, range: null
				}));
		}

		if (this.snippets) {
			complete.suggestions = complete.suggestions.concat(this.snippets);
		}

		this.consolidateItems(complete.suggestions, textDocument, position);
		return complete;
	}

	registerSnippets() { }

}