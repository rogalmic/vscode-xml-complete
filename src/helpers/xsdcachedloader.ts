import XsdLoader from './xsdloader';
import XmlSimpleParser from './xmlsimpleparser';

export default class XsdCachedLoader {

	private static cachedSchemas : Map<string, string> = new Map<string, string>();

	public static async loadSchemaContentsFromUri(schemaLocationUri: string, formatXsd: boolean = true): Promise<string> {
		if (!XsdCachedLoader.cachedSchemas.has(schemaLocationUri)) {
			let content =  await XsdLoader.loadSchemaContentsFromUri(schemaLocationUri);

			if (formatXsd) {
				content = await XmlSimpleParser.formatXml(content, "\t", "\n", "multiLineAttributes");
			}

			XsdCachedLoader.cachedSchemas.set(schemaLocationUri, content);
		}

		let result = XsdCachedLoader.cachedSchemas.get(schemaLocationUri);

		if (result !== undefined) {
			return result;
		}

		throw `Cannot get schema contents from '${schemaLocationUri}'`;
	}
}
