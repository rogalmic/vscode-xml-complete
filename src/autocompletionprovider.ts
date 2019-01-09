import * as vscode from 'vscode';
import { languageId } from './extension';
import { XmlSchemaPropertiesArray } from './types';
import XmlSimpleParser from './helpers/xmlsimpleparser';

export default class AutoCompletionProvider implements vscode.Disposable {

    private documentListener: vscode.Disposable;
    private static maxTagChars = 100;
    private delayCount: number = 0;

    constructor(protected extensionContext: vscode.ExtensionContext, protected schemaPropertiesArray: XmlSchemaPropertiesArray) {
        this.documentListener = vscode.workspace.onDidChangeTextDocument(async (evnt) =>
            this.triggerDelayedAutoCompletion(evnt), this, this.extensionContext.subscriptions);
    }

    public dispose() {
        this.documentListener.dispose();
    }

    private async triggerDelayedAutoCompletion(documentEvent: vscode.TextDocumentChangeEvent, timeout: number = 400): Promise<void> {
        if (this.delayCount > 0) {
            this.delayCount = timeout;
            return;
        }
        this.delayCount = timeout;

        const tick = 100;

        while (this.delayCount > 0) {
            await new Promise(resolve => setTimeout(resolve, tick));
            this.delayCount -= tick;
        }

        this.triggerAutoCompletion(documentEvent);
    }

    private async triggerAutoCompletion(documentEvent: vscode.TextDocumentChangeEvent): Promise<void> {
        const activeTextEditor = vscode.window.activeTextEditor;
        const document = documentEvent.document;

        if (document.languageId !== languageId
            || documentEvent.contentChanges.length !== 1
            || documentEvent.contentChanges[0].text.length > AutoCompletionProvider.maxTagChars
            || !documentEvent.contentChanges[0].range.isSingleLine
            || /\s/.test(documentEvent.contentChanges[0].text)
            || activeTextEditor === undefined
            || activeTextEditor.document.uri.toString() !== document.uri.toString()) {
            return;
        }

        const inputChange = documentEvent.contentChanges[0];
        let inputChangePosition = inputChange.range.end;

        for (let i = 0; i < AutoCompletionProvider.maxTagChars
            && document.getText(new vscode.Range(inputChangePosition, inputChangePosition.translate(0, 1))) !== ">"; i++) {

            inputChangePosition = inputChangePosition.translate(0, 1);
        }

        let inputChangeEndPosition = inputChangePosition.translate(0, 1);

        for (let i = 0; i < AutoCompletionProvider.maxTagChars
            && document.getText(new vscode.Range(inputChangeEndPosition, inputChangeEndPosition.translate(0, 1))) !== ">"; i++) {

            inputChangeEndPosition = inputChangeEndPosition.translate(0, 1);
        }

        let documentContent = document.getText();
        let offset = document.offsetAt(inputChangePosition);

        let scope = await XmlSimpleParser.getScopeForPosition(documentContent, offset - 1);

        if (scope.context && scope.tagName && documentContent[offset - 1] !== "/" && scope.content.indexOf("</") < 0) {

            const before = document.getText(new vscode.Range(document.positionAt(0), inputChangePosition.translate(0, 1)));
            const insertion = `</${scope.tagName}>`;
            const after = document.getText(new vscode.Range(inputChangeEndPosition.translate(0, 1), document.lineAt(document.lineCount - 1).range.end));

            documentContent = before + insertion + after;

            if (!await XmlSimpleParser.checkXml(documentContent)) {
                return;
            }

            await activeTextEditor.edit((builder) => {
                builder.replace(
                    new vscode.Range(
                        inputChangePosition.translate(0, 1),
                        inputChangeEndPosition.translate(0, 1)),
                    insertion);
            }, { undoStopAfter: false, undoStopBefore: false });
        }
        else if (scope.context && scope.tagName && documentContent[offset - 1] === "/") {

            const before = document.getText(new vscode.Range(document.positionAt(0), inputChangePosition));
            const insertion = `>`;
            const after = document.getText(new vscode.Range(inputChangeEndPosition.translate(0, 1), document.lineAt(document.lineCount - 1).range.end));

            documentContent = before + insertion + after;

            if (!await XmlSimpleParser.checkXml(documentContent)) {
                return;
            }

            await activeTextEditor.edit((builder) => {
                builder.replace(
                    new vscode.Range(
                        inputChangePosition,
                        inputChangeEndPosition.translate(0, 1)),
                    insertion);
            }, { undoStopAfter: false, undoStopBefore: false });
        }
    }
}