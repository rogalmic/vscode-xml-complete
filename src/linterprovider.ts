import { XmlDiagnosticData } from './types';
import XmlSimpleParser from './helpers/xmlsimpleparser';
import { Updater } from '../util/Updater';
import XsdSettings from './helpers/settings';

export default class XmlLinterProvider extends Updater implements monaco.IDisposable {

	constructor(languageId: string, changedDelay: number = 2000) {
		super(languageId, changedDelay);
	}

	async doUpdate(resource: monaco.Uri, languageId: string): Promise<void> {
		const textDocument = monaco.editor.getModel(resource);
		if (!textDocument || (textDocument.getModeId() !== "xml" && textDocument.getModeId() !== "html")) {
			return null;
		}

		let documentContent = textDocument.getValue();

		let xsdFileUris = (XmlSimpleParser.getSchemaXsdUris(documentContent,
			XsdSettings.schemaMapping.filter(sm => !sm.noComplete))).map(u => monaco.Uri.parse(u));

		await XsdSettings.prepare(xsdFileUris);

		let nsMap = await XmlSimpleParser.getNamespaceMapping(documentContent);

		const markers: Array<monaco.editor.IMarkerData[]> = [];

		if (xsdFileUris.length === 0) {
			const planXmlCheckResults = XmlSimpleParser.getXmlDiagnosticData(documentContent, null, nsMap);
			markers.push(this.getDiagnosticArray(planXmlCheckResults));
		}
		else {
			let schemaProperties = XsdSettings.schemaPropertiesArray.filterUris(xsdFileUris);
			let diagnosticResults = XmlSimpleParser.getXmlDiagnosticData(documentContent, schemaProperties, nsMap);
			markers.push(this.getDiagnosticArray(diagnosticResults));
		}

		monaco.editor.setModelMarkers(textDocument, "xml-lint",
			markers.reduce((prev, next) =>
				prev.filter(dp => next.find(dn => dn.startLineNumber === dp.startLineNumber && dn.startColumn === dp.startColumn))));
	}

	private getDiagnosticArray(data: XmlDiagnosticData[]): monaco.editor.IMarkerData[] {
		return data.map(r => {
			return {
				message: r.message,
				severity: (r.severity === "error") ? monaco.MarkerSeverity.Error :
					(r.severity === "warning") ? monaco.MarkerSeverity.Warning :
						(r.severity === "info") ? monaco.MarkerSeverity.Info :
							monaco.MarkerSeverity.Hint,
				startLineNumber: r.range.startLineNumber + 1,
				startColumn: r.range.startColumn,
				endLineNumber: r.range.endLineNumber + 1,
				endColumn: r.range.endColumn,
			} as monaco.editor.IMarkerData;
		});
	}

	public dispose(): void {
		super.dispose();
	}
}