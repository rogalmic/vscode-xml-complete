import * as vscode from 'vscode';
import XsdLoader from './xsdloader';
import XmlSimpleParser from './xmlsimpleparser';
import * as Cache from 'vscode-cache';

export default class XsdCachedLoader {

    private static cachedSchemas: Map<string, string> = new Map<string, string>();

    private static vscodeCache: Cache;
    private static pluginVersion: string;

    public static InitVscodeCache(extensionContext: vscode.ExtensionContext): void {
        XsdCachedLoader.vscodeCache = new Cache(extensionContext);
        XsdCachedLoader.pluginVersion = vscode.extensions.getExtension('rogalmic.vscode-xml-complete')?.packageJSON.version as string;
    }

    public static async loadSchemaContentsFromUri(schemaLocationUri: string, formatXsd = true, xsdCachePattern: string | undefined = undefined): Promise<{ data: string, cached: boolean }> {
        const cacheLocally = xsdCachePattern && (schemaLocationUri.match(xsdCachePattern) != null)
        const schemaLocationUriVersioned = `${schemaLocationUri}?v=${this.pluginVersion}`;

        if (cacheLocally) {
            if (this.vscodeCache.has(schemaLocationUriVersioned)) {
                const q = this.vscodeCache.get(schemaLocationUriVersioned);
                return { data: q, cached: true };
            }
        }
        if (!XsdCachedLoader.cachedSchemas.has(schemaLocationUri)) {
            let content = await XsdLoader.loadSchemaContentsFromUri(schemaLocationUri);

            if (formatXsd) {
                content = await XmlSimpleParser.formatXml(content, "\t", "\n", "multiLineAttributes");
            }

            XsdCachedLoader.cachedSchemas.set(schemaLocationUri, content);
        }

        const result = XsdCachedLoader.cachedSchemas.get(schemaLocationUri);

        if (result !== undefined) {
            if (cacheLocally) {
                // purge previous
                const keys: string[] = this.vscodeCache.keys();
                const toRemove: string[] = [];
                keys.forEach(x => {
                    if (x.startsWith(schemaLocationUri))
                        toRemove.push(x);
                });
                toRemove.forEach(x => this.vscodeCache.forget(x));

                // add new one
                this.vscodeCache.put(schemaLocationUriVersioned, result);
            }
            return { data: result, cached: false };
        }

        throw `Cannot get schema contents from '${schemaLocationUri}'`;
    }
}
