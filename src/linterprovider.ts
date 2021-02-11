import * as vscode from 'vscode';
import { languageId, globalSettings } from './extension';
import { XmlSchemaProperties, XmlTagCollection, XmlSchemaPropertiesArray, XmlDiagnosticData } from './types';
import XsdParser from './helpers/xsdparser';
import XsdCachedLoader from './helpers/xsdcachedloader';
import XmlSimpleParser from './helpers/xmlsimpleparser';

export default class XmlLinterProvider implements vscode.Disposable {

    private documentListener: vscode.Disposable;
    private diagnosticCollection: vscode.DiagnosticCollection;
    private delayCount: number = Number.MIN_SAFE_INTEGER;
    private textDocument: vscode.TextDocument;
    private linterActive = false;

    constructor(protected extensionContext: vscode.ExtensionContext, protected schemaPropertiesArray: XmlSchemaPropertiesArray) {
        this.schemaPropertiesArray = schemaPropertiesArray;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection();

        XsdCachedLoader.InitVscodeCache(extensionContext);

        this.documentListener = vscode.workspace.onDidChangeTextDocument(evnt =>
            this.triggerDelayedLint(evnt.document), this, this.extensionContext.subscriptions);

        vscode.workspace.onDidOpenTextDocument(doc =>
            this.triggerDelayedLint(doc, 100), this, extensionContext.subscriptions);

        vscode.workspace.onDidCloseTextDocument(doc =>
            this.cleanupDocument(doc), null, extensionContext.subscriptions);

        vscode.workspace.textDocuments.forEach(doc =>
            this.triggerDelayedLint(doc, 100), this);
    }

    public dispose(): void {
        this.documentListener.dispose();
        this.diagnosticCollection.clear();
    }

    private cleanupDocument(textDocument: vscode.TextDocument): void {
        this.diagnosticCollection.delete(textDocument.uri);
    }

    private async triggerDelayedLint(textDocument: vscode.TextDocument, timeout = 2000): Promise<void> {
        if (this.delayCount > Number.MIN_SAFE_INTEGER) {
            this.delayCount = timeout;
            this.textDocument = textDocument;
            return;
        }
        this.delayCount = timeout;
        this.textDocument = textDocument;

        const tick = 100;

        while (this.delayCount > 0 || this.linterActive) {
            await new Promise(resolve => setTimeout(resolve, tick));
            this.delayCount -= tick;
        }

        try {
            this.linterActive = true;
            await this.triggerLint(this.textDocument);
        }
        finally {
            this.delayCount = Number.MIN_SAFE_INTEGER;
            this.linterActive = false;
        }
    }

    private async triggerLint(textDocument: vscode.TextDocument): Promise<void> {

        if (textDocument.languageId !== languageId) {
            return;
        }

        const t0 = new Date().getTime();
        const diagnostics: Array<vscode.Diagnostic[]> = new Array<vscode.Diagnostic[]>();
        try {
            const documentContent = textDocument.getText();

            const xsdFileUris = (await XmlSimpleParser.getSchemaXsdUris(documentContent, textDocument.uri.toString(true), globalSettings.schemaMapping))
                .map(u => vscode.Uri.parse(u))
                .filter((v, i, a) => a.findIndex(u => u.toString() === v.toString()) === i)
                .map(u => ({ uri: u, parentUri: u}));

            const nsMap = await XmlSimpleParser.getNamespaceMapping(documentContent);

            const text = textDocument.getText();

            if (xsdFileUris.length === 0) {
                const plainXmlCheckResults = await XmlSimpleParser.getXmlDiagnosticData(text, [], nsMap, false);
                diagnostics.push(this.getDiagnosticArray(plainXmlCheckResults));
            }

            const currentTagCollections: XmlTagCollection[] = [];

            while (xsdFileUris.length > 0) {
                const currentUriPair =  xsdFileUris.shift() || { uri: vscode.Uri.parse(``), parentUri: vscode.Uri.parse(``)};
                const xsdUri = currentUriPair.uri;

                if (this.schemaPropertiesArray.filterUris([xsdUri]).length === 0) {
                    const schemaProperty = { schemaUri: currentUriPair.uri, parentSchemaUri: currentUriPair.parentUri, xsdContent: ``, tagCollection: new XmlTagCollection() } as XmlSchemaProperties;

                    try {
                        const xsdUriString = xsdUri.toString(true);
                        const q = await XsdCachedLoader.loadSchemaContentsFromUri(xsdUriString, true, globalSettings.xsdCachePattern);
                        schemaProperty.xsdContent = q.data;
                        schemaProperty.tagCollection = await XsdParser.getSchemaTagsAndAttributes(schemaProperty.xsdContent, xsdUriString, (u) => xsdFileUris.push({ uri: vscode.Uri.parse(XmlSimpleParser.ensureAbsoluteUri(u, xsdUriString)), parentUri: currentUriPair.parentUri}));
                        const s = xsdUri.toString();
                        vscode.window.showInformationMessage(`Loaded ${q.cached ? '(cache) ' : ''}${s.length>48 ? '...' : ''}${s.substr(Math.max(0, s.length-48))}`);
                    }
                    catch (err) {
                        vscode.window.showErrorMessage(err.toString());
                    } finally {
                        this.schemaPropertiesArray.push(schemaProperty);
                        currentTagCollections.push(schemaProperty.tagCollection);
                    }
                }
            }

            const diagnosticResults = await XmlSimpleParser.getXmlDiagnosticData(text, currentTagCollections, nsMap, false);
            diagnostics.push(this.getDiagnosticArray(diagnosticResults));

            this.diagnosticCollection.set(textDocument.uri, diagnostics
                .reduce((prev, next) => prev.filter(dp => next.some(dn => dn.range.start.compareTo(dp.range.start) === 0))));
        }
        catch (err) {
            vscode.window.showErrorMessage(err.toString());
        }
        finally {
            const t1 = new Date().getTime();
            console.debug(`Linter took ${t1 - t0} milliseconds.`);
        }
    }

    private getDiagnosticArray(data: XmlDiagnosticData[]): vscode.Diagnostic[] {
        return data.map(r => {
            const position = new vscode.Position(r.line, r.column);
            const severity = (r.severity === "error") ? vscode.DiagnosticSeverity.Error :
                (r.severity === "warning") ? vscode.DiagnosticSeverity.Warning :
                    (r.severity === "info") ? vscode.DiagnosticSeverity.Information :
                        vscode.DiagnosticSeverity.Hint;
            return new vscode.Diagnostic(new vscode.Range(position, position), r.message, severity);
        });
    }
}