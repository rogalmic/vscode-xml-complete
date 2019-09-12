import * as vscode from 'vscode';
import { languageId, globalSettings } from './extension';
import { XmlSchemaProperties, XmlTagCollection, XmlSchemaPropertiesArray, XmlDiagnosticData } from './types';
import XsdParser from './helpers/xsdparser';
import XsdCachedLoader from './helpers/xsdcachedloader';
import XmlSimpleParser from './helpers/xmlsimpleparser';

export default class XmlLinterProvider implements vscode.Disposable {

    private documentListener: vscode.Disposable;
    private diagnosticCollection: vscode.DiagnosticCollection;
    private delayCount: number = 0;
    private textDocument: vscode.TextDocument;

    constructor(protected extensionContext: vscode.ExtensionContext, protected schemaPropertiesArray: XmlSchemaPropertiesArray) {
        this.schemaPropertiesArray = schemaPropertiesArray;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection();

        this.documentListener = vscode.workspace.onDidChangeTextDocument(evnt =>
            this.triggerDelayedLint(evnt.document), this, this.extensionContext.subscriptions);

        vscode.workspace.onDidOpenTextDocument(doc =>
            this.triggerDelayedLint(doc, 100), this, extensionContext.subscriptions);

        vscode.workspace.onDidCloseTextDocument(doc =>
            this.cleanupDocument(doc), null, extensionContext.subscriptions);
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
            this.textDocument = textDocument;
            return;
        }
        this.delayCount = timeout;
        this.textDocument = textDocument;

        const tick = 100;

        while (this.delayCount > 0) {
            await new Promise(resolve => setTimeout(resolve, tick));
            this.delayCount -= tick;
        }

        this.triggerLint(this.textDocument);
    }

    private async triggerLint(textDocument: vscode.TextDocument): Promise<void> {

        if (textDocument.languageId !== languageId) {
            return;
        }

        let diagnostics: Array<vscode.Diagnostic[]> = new Array<vscode.Diagnostic[]>();
        try {
            let documentContent = textDocument.getText();

            let xsdFileUris = (await XmlSimpleParser.getSchemaXsdUris(documentContent, globalSettings.schemaMapping))
                .map(u => vscode.Uri.parse(u))
                .filter((v, i, a) => a.findIndex(u => u.toString() === v.toString()) === i);

            let nsMap = await XmlSimpleParser.getNamespaceMapping(documentContent);

            const text = textDocument.getText();

            for (let xsdUri of xsdFileUris) {
                let schemaProperties = this.schemaPropertiesArray
                    .filterUris([xsdUri])[0];

                if (schemaProperties === undefined) {
                    schemaProperties = { schemaUri: xsdUri, xsdContent: ``, tagCollection: new XmlTagCollection() } as XmlSchemaProperties;

                    try {
                        let xsdUriString = xsdUri.toString(true);
                        schemaProperties.xsdContent = await XsdCachedLoader.loadSchemaContentsFromUri(xsdUriString);
                        schemaProperties.tagCollection = await XsdParser.getSchemaTagsAndAttributes(schemaProperties.xsdContent, xsdUriString);
                        vscode.window.showInformationMessage(`Loaded ...${xsdUri.toString().substr(xsdUri.path.length - 16)}`);
                    }
                    catch (err) {
                        vscode.window.showErrorMessage(err.toString());
                    } finally {
                        this.schemaPropertiesArray.push(schemaProperties);
                    }
                }

                const strict = !globalSettings.schemaMapping.find(m => m.xsdUri === xsdUri.toString() && m.strict === false);
                let diagnosticResults = await XmlSimpleParser.getXmlDiagnosticData(text, schemaProperties.tagCollection, nsMap, strict);

                diagnostics.push(this.getDiagnosticArray(diagnosticResults));
            }

            if (xsdFileUris.length === 0) {
                const planXmlCheckResults = await XmlSimpleParser.getXmlDiagnosticData(text, new XmlTagCollection(), nsMap, false);
                diagnostics.push(this.getDiagnosticArray(planXmlCheckResults));
            }

            this.diagnosticCollection.set(textDocument.uri, diagnostics
                .reduce((prev, next) => prev.filter(dp => next.find(dn => dn.range.start.compareTo(dp.range.start) === 0))));
        }
        catch (err) {
            vscode.window.showErrorMessage(err.toString());
        }
    }

    private getDiagnosticArray(data: XmlDiagnosticData[]): vscode.Diagnostic[] {
        return data.map(r => {
            let position = new vscode.Position(r.line, r.column);
            let severity = (r.severity === "error") ? vscode.DiagnosticSeverity.Error :
                (r.severity === "warning") ? vscode.DiagnosticSeverity.Warning :
                    (r.severity === "info") ? vscode.DiagnosticSeverity.Information :
                        vscode.DiagnosticSeverity.Hint;
            return new vscode.Diagnostic(new vscode.Range(position, position), r.message, severity);
        });
    }
}