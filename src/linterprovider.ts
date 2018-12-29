import * as vscode from 'vscode';
import { IXmlSchemaProperties, languageId, globalSettings } from './extension';
import XsdParser from './helpers/xsdparser';
import XsdLoader from './helpers/xsdloader';
import XmlSimpleParser from './helpers/xmlsimpleparser';

export default class XmlLinterProvider implements vscode.Disposable {

    private documentListener: vscode.Disposable;
    private diagnosticCollection: vscode.DiagnosticCollection;
    private schemaPropertiesArray: Array<IXmlSchemaProperties>;

    constructor(private context: vscode.ExtensionContext, schemaPropertiesArray: Array<IXmlSchemaProperties>) {
        this.schemaPropertiesArray = schemaPropertiesArray;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection();

        this.documentListener = vscode.workspace.onDidChangeTextDocument(evnt => this.triggerLint(evnt.document), this, this.context.subscriptions);

        vscode.workspace.onDidOpenTextDocument(doc => this.triggerLint(doc), this, context.subscriptions);
        vscode.workspace.onDidCloseTextDocument(doc => this.cleanupDocument(doc), null, context.subscriptions);

        vscode.workspace.textDocuments.forEach(doc => this.triggerLint(doc), this);
    }

    public dispose() {
        this.documentListener.dispose();
        this.diagnosticCollection.clear();
    }

    private cleanupDocument(textDocument: vscode.TextDocument): void {
        this.diagnosticCollection.delete(textDocument.uri);
    }

    //vscode.CancellationToken

    private async triggerLint(textDocument: vscode.TextDocument): Promise<void> {

        if (textDocument.languageId !== languageId) {
            return;
        }

        const diagnostics: vscode.Diagnostic[] = [];
        try {
            let xsdFileUris = (await XmlSimpleParser.getSchemaXsdUris(textDocument.getText(), globalSettings.schemaMapping)).map(u => vscode.Uri.parse(u));

            for (let xsdUri of xsdFileUris) {
                let schemaProperties = this.schemaPropertiesArray.find(e => e.schemaUri.toString() === xsdUri.toString());
                if (schemaProperties === undefined) {
                    schemaProperties = { schemaUri: xsdUri, xsdContent: ``, tagCollection: [] } as IXmlSchemaProperties;

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

                let result = await XmlSimpleParser.getXmlDiagnosticData(textDocument.getText(), schemaProperties.tagCollection);

                let diagnosticResults = result.map(r => {
                    let position = new vscode.Position(r.line, r.column);
                    let severity = (r.severity === "error") ? vscode.DiagnosticSeverity.Error : (r.severity === "warning") ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information;
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