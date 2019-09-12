import XmlSimpleParser from './helpers/xmlsimpleparser';
import { Updater } from '../util/Updater';

export default class AutoCompletionProvider extends Updater implements monaco.IDisposable {

	constructor(languageId: string) {
		super(languageId, 0);
	}

	private static maxLineChars = 1024;
	private static maxLines = 8096;

	async doUpdate(resource: monaco.Uri, languageId: string, documentEvent: monaco.editor.IModelContentChangedEvent): Promise<void> {
		if (!documentEvent)
			return null;
		const document = monaco.editor.getModel(resource) as IMdlnModel;
		if (!document || !document.editor)
			return null;

		const inputChange = documentEvent.changes[0];

		if (document.getModeId() !== languageId
			|| documentEvent.changes.length !== 1
			|| inputChange.range.startLineNumber - inputChange.range.endLineNumber !== 0
			|| (inputChange.text && inputChange.text.indexOf("\n") >= 0)
			|| document.getLineCount() > AutoCompletionProvider.maxLines) {
			return null;
		}

		const changeLine = inputChange.range.endLineNumber;
		const wholeLineRange = new monaco.Range(changeLine, 1, changeLine, document.getLineLength(changeLine) + 1);
		const wholeLineText = document.getLineContent(inputChange.range.startLineNumber);

		let linePosition = (inputChange.range.startColumn - 1) + (inputChange.text.length - 1);

		if (wholeLineText.length >= AutoCompletionProvider.maxLineChars) {
			return null;
		}

		const scope = await XmlSimpleParser.getScopeForPosition(`${wholeLineText}\n`, linePosition);

		if (--linePosition < 0) {
			// NOTE: automatic acions require info about previous char
			return null;
		}

		const before = wholeLineText.substring(0, linePosition);
		const after = wholeLineText.substring(linePosition);

		if (!(scope.context && scope.context !== "text" && scope.tagName)) {
			// NOTE: unknown scope
			return null;
		}

		if (before.substr(before.lastIndexOf("<"), 2) === "</") {
			// NOTE: current position in closing tag
			return null;
		}
		if (after.indexOf(">") <= 0) {
			return null;
		}

		// NOTE: auto-change is available only for single tag enclosed in one line
		const closeCurrentTagIndex = after.indexOf(">");
		const nextTagStartPosition = after.indexOf("<");
		const nextTagEndingPosition = nextTagStartPosition >= 0 ? after.indexOf(">", nextTagStartPosition) : -1;
		const invalidTagStartPosition = nextTagEndingPosition >= 0 ? after.indexOf("<", nextTagEndingPosition) : -1;

		let resultText: string = "";

		if (after.substr(closeCurrentTagIndex - 1).startsWith(`/></${scope.tagName}>`) && closeCurrentTagIndex === 1) {

			resultText = wholeLineText.substring(0, linePosition + nextTagStartPosition) + `` + wholeLineText.substring(linePosition + nextTagEndingPosition + 1);

		} else if (after.substr(closeCurrentTagIndex - 1, 2) !== "/>" && invalidTagStartPosition < 0) {

			if (nextTagStartPosition >= 0 && after[nextTagStartPosition + 1] === "/") {

				resultText = wholeLineText.substring(0, linePosition + nextTagStartPosition) + `</${scope.tagName}>` + wholeLineText.substring(linePosition + nextTagEndingPosition + 1);
			}
			else if (nextTagStartPosition < 0) {
				resultText = wholeLineText.substring(0, linePosition + closeCurrentTagIndex + 1) + `</${scope.tagName}>` + wholeLineText.substring(linePosition + closeCurrentTagIndex + 1);
			}
		}

		if (!resultText || resultText.trim() === wholeLineText.trim()) {
			return null;
		}

		resultText = resultText.trimEnd();

		if (!await XmlSimpleParser.checkXml(`${resultText}`)) {
			// NOTE: Single line must be ok, one element in line
			//console.log("bad xml 1: " + resultText);
			return null;
		}

		let documentContent = document.getValue();

		documentContent = documentContent.split("\n")
			.map((l, i) => (i === changeLine - 1) ? resultText : l)
			.join("\n");

		if (!await XmlSimpleParser.checkXml(documentContent)) {
			// NOTE: Check whole document
			//console.log("bad xml 2");
			return null;
		}

		document.pushEditOperations([], [{
			forceMoveMarkers: false,
			range: wholeLineRange,
			text: resultText
		} as monaco.editor.IIdentifiedSingleEditOperation], null);

		if (document.editor) {
			document.editor.setPosition({
				lineNumber: inputChange.range.startLineNumber,
				column: inputChange.range.startColumn + 1
			});
		}
	}
}