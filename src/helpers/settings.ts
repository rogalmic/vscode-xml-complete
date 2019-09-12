import { XmlSchemaPropertiesArray, XmlSchemaProperties } from "../types";
import XsdParser from "./xsdparser";
import { Server } from "../../util/Server";

export interface ISnippet {
	parentTags: string[],
	label: string;
	insertText: string;
	detail?: string;
	documentation?: string;
}

export interface IXsdSetting {
	xmlns: string;
	xsdUri: string;
	strict: boolean;
	noComplete?: boolean;
	snippets?: ISnippet[];
	rootSnippets?: ISnippet[];
}

export default class XsdSettings {

	static schemaPropertiesArray: XmlSchemaPropertiesArray;
	static schemaMapping: IXsdSetting[];

	public static init() {
		if (XsdSettings.schemaPropertiesArray)
			return;
		require(["sax"], () => {
			//console.log("sax loaded")
		});
		
		XsdSettings.schemaPropertiesArray = new XmlSchemaPropertiesArray();
		/*
		// SAMPLE: Set `schemaMapping` via load settings
		XsdSettings.schemaMapping = [
			{ xmlns: "http://myschemas.net/myscheme", xsdUri: "http://myschemas.net/myscheme.xsd", strict: true, 
				rootSnippets: [ ... like snippets but for all xml docs in in the root - to insert root element ]
				snippets: [{ 
					label: "mysnip", 
					parentTags: ["must-be-child-of-this"], 
					insertText: "my:tag attr=\"${1:\\the value}\">\n\t$0\n</my:tag>", 
					documentation: "Sample snippet" 
				}]}];
		*/
	}

	public static async prepare(xsdFileUris: monaco.Uri[]) {
		// first load all
		for (let xsdUri of xsdFileUris) {
			let schemaProperties = XsdSettings.schemaPropertiesArray.filterUris([xsdUri])[0];
			if (!schemaProperties) {
				schemaProperties = { schemaUri: xsdUri, xsdContent: null, tagCollection: null } as XmlSchemaProperties;
				schemaProperties.namespace = XsdSettings.schemaMapping.filter(sm => sm.xsdUri === xsdUri.toString())[0].xmlns;
				
				//schemaProperties.xsdContent = await XsdLoader.loadSchemaContentsFromUri(xsdUri.toString(true));
				schemaProperties.xsdContent = await Server.loadContentFromUri(xsdUri.toString(true));

				XsdSettings.schemaPropertiesArray.push(schemaProperties);
			}
		}
		// ... then parse them
		for (var i = 0; i < XsdSettings.schemaPropertiesArray.length; i++) {
			if (!XsdSettings.schemaPropertiesArray[i].tagCollection) {
				await XsdParser.getSchemaTagsAndAttributes(XsdSettings.schemaPropertiesArray[i]);
			}
		}
	}


}
