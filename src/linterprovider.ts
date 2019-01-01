import * as vscode from 'vscode';
import { languageId, globalSettings } from './extension';
import { XmlSchemaProperties, XmlTagCollection } from './types';
import XsdParser from './helpers/xsdparser';
import XsdLoader from './helpers/xsdloader';
import XmlSimpleParser from './helpers/xmlsimpleparser';

export default class XmlLinterProvider implements vscode.Disposable {

    private documentListener: vscode.Disposable;
    private diagnosticCollection: vscode.DiagnosticCollection;
    private schemaPropertiesArray: Array<XmlSchemaProperties>;
    private delayCount: number = 0;

    constructor(private context: vscode.ExtensionContext, schemaPropertiesArray: Array<XmlSchemaProperties>) {
        this.schemaPropertiesArray = schemaPropertiesArray;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection();

        this.documentListener = vscode.workspace.onDidChangeTextDocument(evnt =>
            this.triggerDelayedLint(evnt.document), this, this.context.subscriptions);

        vscode.workspace.onDidOpenTextDocument(doc =>
            this.triggerDelayedLint(doc, 100), this, context.subscriptions);

        vscode.workspace.onDidCloseTextDocument(doc =>
            this.cleanupDocument(doc), null, context.subscriptions);

        vscode.workspace.textDocuments.forEach(doc =>
            this.triggerDelayedLint(doc, 100), this);
    }

    public dispose() {
        this.documentListener.dispose();
        this.diagnosticCollection.clear();
    }

    private cleanupDocument(textDocument: vscode.TextDocument): void {
        this.diagnosticCollection.delete(textDocument.uri);
    }

    private async triggerDelayedLint(textDocument: vscode.TextDocument, timeout: number = 2000): Promise<void> {
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

        this.triggerLint(textDocument);
    }

    private async triggerLint(textDocument: vscode.TextDocument): Promise<void> {

        if (textDocument.languageId !== languageId) {
            return;
        }

        const diagnostics: vscode.Diagnostic[] = [];
        try {
            let xsdFileUris = (await XmlSimpleParser.getSchemaXsdUris(textDocument.getText(), globalSettings.schemaMapping))
                .map(u => vscode.Uri.parse(u));

            for (let xsdUri of xsdFileUris) {
                let schemaProperties = this.schemaPropertiesArray.find(e => e.schemaUri.toString() === xsdUri.toString());
                if (schemaProperties === undefined) {
                    schemaProperties = { schemaUri: xsdUri, xsdContent: ``, tagCollection: new XmlTagCollection() } as XmlSchemaProperties;

                    try {
                        schemaProperties.xsdContent = await XsdLoader.loadSchemaContentsFromUri(xsdUri.toString(true));
                        schemaProperties.tagCollection = await XsdParser.getSchemaTagsAndAttributes(schemaProperties.xsdContent);
                    }
                    catch (err) {
                        vscode.window.showErrorMessage(err);
                    } finally {
                        this.schemaPropertiesArray.push(schemaProperties);
                    }
                }

                const strict = !globalSettings.schemaMapping.find(m => m.xsdUri.toString() === xsdUri.toString() && m.strict === false);
                let result = await XmlSimpleParser.getXmlDiagnosticData(textDocument.getText(), schemaProperties.tagCollection, strict);

                let diagnosticResults = result.map(r => {
                    let position = new vscode.Position(r.line, r.column);
                    let severity = (r.severity === "error") ? vscode.DiagnosticSeverity.Error :
                        (r.severity === "warning") ? vscode.DiagnosticSeverity.Warning :
                            (r.severity === "info") ? vscode.DiagnosticSeverity.Information :
                                vscode.DiagnosticSeverity.Hint;
                    return new vscode.Diagnostic(new vscode.Range(position, position), r.message, severity);
                });
                diagnostics.push(...diagnosticResults);
            }

            this.diagnosticCollection.set(textDocument.uri, diagnostics);
        }
        catch (err) {
            vscode.window.showErrorMessage(err);
        }
    }
}