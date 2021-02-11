import { XmlTagCollection, CompletionString } from '../types';

export default class XsdParser {

	public static getSchemaTagsAndAttributes(xsdContent: string, xsdUri: string, importExtraXsdFunc : (uri: string) => void): Promise<XmlTagCollection> {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const sax = require("sax");
		const parser = sax.parser(true);

		const getCompletionString = (name: string, comment?: string) => new CompletionString(name, comment, xsdUri, parser.line, parser.column);

		return new Promise<XmlTagCollection>(
			(resolve) => {
				const result: XmlTagCollection = new XmlTagCollection();
				const xmlDepthPath: { tag: string, resultTagName: string }[] = [];

				let calls = 0;
				parser.onopentag = (tagData: { name: string, isSelfClosing: boolean, attributes: Map<string, string> }) => {
					calls++;
					xmlDepthPath.push({
						tag: tagData.name,
						resultTagName: tagData.attributes["name"]
					});

					if (tagData.name.endsWith(":attribute") && tagData.attributes["name"] !== undefined) {
						const currentResultTag = xmlDepthPath
							.filter(e => e.resultTagName !== undefined)
							.slice(-2)[0];
						result
							.filter(e => e.tag.name === currentResultTag?.resultTagName)
							.forEach(e => e.attributes.push(getCompletionString(tagData.attributes["name"])));
					}
					else if (tagData.name.endsWith(":element") && tagData.attributes["name"] !== undefined) {
						result.push({
							tag: getCompletionString(tagData.attributes["name"]),
							base: tagData.attributes["type"] !== undefined ? [tagData.attributes["type"]] : [],
							attributes: [],
							visible: true
						});
					}
					else if (tagData.name.endsWith(":complexType") && tagData.attributes["name"] !== undefined) {
						result.push({
							tag: getCompletionString(tagData.attributes["name"]),
							base: [],
							attributes: [],
							visible: false
						});
					}
					else if (tagData.name.endsWith(":attributeGroup") && tagData.attributes["name"] !== undefined) {
						result.push({
							tag: getCompletionString(tagData.attributes["name"]),
							base: [],
							attributes: [],
							visible: false
						});
					}
					else if (tagData.name.endsWith(":extension") && tagData.attributes["base"] !== undefined) {
						const currentResultTag = xmlDepthPath
							.filter(e => e.resultTagName !== undefined)
							.slice(-1)[0];

						result
							.filter(e => e.tag.name === currentResultTag?.resultTagName)
							.forEach(e => e.base.push(tagData.attributes["base"]));
					}
					else if (tagData.name.endsWith(":attributeGroup") && tagData.attributes["ref"] !== undefined) {
						const currentResultTag = xmlDepthPath
							.filter(e => e.resultTagName !== undefined)
							.slice(-1)[0];

						result
							.filter(e => e.tag.name === currentResultTag?.resultTagName)
							.forEach(e => e.base.push(tagData.attributes["ref"]));
					}
					else if (tagData.name.endsWith(":schema")) {
						Object.keys(tagData.attributes).forEach((k) =>
						{
							if (k.startsWith("xmlns:"))
							{
								result.setNsMap(k.substring("xmlns:".length), tagData.attributes[k]);
							}
						});
					}
					else if (tagData.name.endsWith(":import") && tagData.attributes["schemaLocation"] !== undefined && importExtraXsdFunc) {
						importExtraXsdFunc(tagData.attributes["schemaLocation"]);
					}
					else if (tagData.name.endsWith(":include") && tagData.attributes["schemaLocation"] !== undefined && importExtraXsdFunc) {
						importExtraXsdFunc(tagData.attributes["schemaLocation"]);
					}
				};

				parser.onclosetag = (name: string) => {
					calls ++;
					const popped = xmlDepthPath.pop();

					if (popped?.tag !== name) {
						console.warn("XSD open/close tag consistency error.");
					}
				};

				parser.ontext = (t: string) => {
					calls ++;

					if (/\S/.test(t) && xmlDepthPath.some(e => e.tag.endsWith(":documentation"))) {
						const stack = xmlDepthPath
							.filter(e => e?.resultTagName !== undefined)
							.slice(-2);

						const currentCommentTargetParrent = stack[0];
						const currentCommentTarget = stack[stack.length - 1];

						if (currentCommentTarget?.tag?.endsWith(":element")) {
							result
								.filter(e => e.tag.name === currentCommentTarget?.resultTagName)
								.forEach(e => e.tag.comment = t.trim());
						}
						else if (currentCommentTarget?.tag?.endsWith(":attribute")) {
							result
								.filter(e => e.tag.name === currentCommentTargetParrent?.resultTagName)
								.flatMap(e => e.attributes)
								.filter(e => e.name === currentCommentTarget?.resultTagName)
								.forEach(e => e.comment = t.trim());
						}
					}
				};

				parser.onend = () => {
					if (xmlDepthPath.length !== 0) {
						console.warn("XSD open/close tag consistency error (end).");
					}

					console.debug(`Number of calls from sax library xsd parsing: ${calls}`);

					resolve(result);
				};

				parser.write(xsdContent).close();
			});
	}
}