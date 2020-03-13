using System;
using System.Linq;
using System.Xml.Linq;
using System.Reflection;
using System.Diagnostics;
using System.Windows;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.IO;

namespace Wpf
{
    public static class Program
    {
        private static XNamespace ns = "http://www.w3.org/2001/XMLSchema";

        private static Regex alphanumeric = new Regex("[^a-zA-Z0-9 -]");

        private static XDocument XmlDocumentation;

        [STAThreadAttribute]
        [DebuggerNonUserCodeAttribute]
        public static void Main(string[] args)
        {
            Func<string, bool> isAlphanumeric = str => !alphanumeric.IsMatch(str);

            var assembly = Assembly.GetAssembly(typeof(FrameworkElement));
            var controlsWithAttributes = assembly.GetExportedTypes()
                .Where(t => !t.IsAbstract && typeof(FrameworkElement).IsAssignableFrom(t) && isAlphanumeric(t.Name))
                .ToDictionary(t => t.Name, t => t.GetProperties().Where(p => isAlphanumeric(p.Name)).Select(p => p.Name).Distinct().ToList());

            var baseControl = controlsWithAttributes.First(c => c.Key == typeof(FrameworkElement).Name);
            controlsWithAttributes.Remove(typeof(FrameworkElement).Name);

            foreach (var ca in controlsWithAttributes)
            {
                ca.Value.RemoveAll(c => baseControl.Value.Contains(c));
            }

            XElement root = new XElement(ns + "schema",
                new XAttribute("id", "WpfXamlSchema"),
                new XAttribute("targetNamespace", "http://schemas.microsoft.com/winfx/2006/xaml/presentation"),
                new XAttribute("elementFormDefault", "qualified"),
                new XAttribute("xmlns", "http://schemas.microsoft.com/winfx/2006/xaml/presentation"),
                new XAttribute(XNamespace.Xmlns + "xs", "http://www.w3.org/2001/XMLSchema"),
                new XAttribute(XNamespace.Xmlns + "noNamespaceSchemaLocation", "https://www.w3.org/2001/XMLSchema.xsd"));

            root.Add(GetSimpleTypes());
            root.Add(GetBaseControlType(baseControl.Value));
            root.Add(GetControlGroup(controlsWithAttributes.Keys));
            root.Add(controlsWithAttributes.Select(c => GetControlElement(c.Key, c.Value, baseControl.Value)).ToArray());
            root.Add(GetStyleRelatedTag());

            var document = new XDocument();
            document.Add(root);
            document.Save("Wpf.Formatted.xsd", SaveOptions.None);
            document.Save("Wpf.xsd", SaveOptions.DisableFormatting);
        }

        private static XElement GetControlElement(string controlName, IEnumerable<string> controlAttributes, IEnumerable<string> baseAttributeNames)
        {
            var extension = new XElement(ns + "extension", new XAttribute("base", "FrameworkElement"));
            extension.Add(GetAttributes(controlAttributes, controlName));
            var complexContent = new XElement(ns + "complexContent");
            complexContent.Add(extension);
            var complexType = new XElement(ns + "complexType", new XAttribute("mixed", "true"));
            complexType.Add(complexContent);
            var element = new XElement(ns + "element", new XAttribute("name", controlName));
            element.Add(GetDocumentationNodeFromName(controlName));
            element.Add(complexType);
            return element;
        }

        private static XElement GetControlGroup(IEnumerable<string> controlNames)
        {
            var elements = controlNames.Select(cn => new XElement(ns + "element", new XAttribute("ref", cn))).ToArray();
            var choice = new XElement(ns + "choice");
            choice.Add(elements);
            var group = new XElement(ns + "group", new XAttribute("name", "controls"));
            group.Add(choice);
            return group;
        }

        private static XElement GetBaseControlType(IEnumerable<string> controlAttributes)
        {
            var group = new XElement(ns + "group", new XAttribute("ref", "controls"));
            var any = new XElement(ns + "any", new XAttribute("maxOccurs", "unbounded"), new XAttribute("processContents", "lax"));
            var anyAttribute = new XElement(ns + "anyAttribute", new XAttribute("namespace", "##local http://schemas.microsoft.com/winfx/2006/xaml http://schemas.openxmlformats.org/markup-compatibility/2006"), new XAttribute("processContents", "skip"));

            var choice = new XElement(ns + "choice", new XAttribute("minOccurs", "0"), new XAttribute("maxOccurs", "unbounded"));
            choice.Add(group, any);
            var complexType = new XElement(ns + "complexType", new XAttribute("name", "FrameworkElement"), new XAttribute("mixed", "true"));
            complexType.Add(choice);
            AppendAttributes(complexType, GetAttributes(controlAttributes, "FrameworkElement"));
            AppendAttributes(complexType, GetAttributes(controlAttributes, "UIElement"));
            complexType.Add(anyAttribute);
            return complexType;
        }

        private static void AppendAttributes(XElement controlType, IEnumerable<XElement> elementsToAdd)
        {
            var controlTypeElements =  controlType.Elements(ns + "attribute").ToArray();

            foreach (var e in elementsToAdd)
            {
                var existingElements =  controlTypeElements.Where(a => 
                    a.Attribute("name").Value == e.Attribute("name").Value).ToList();

                if (existingElements.Any())
                {
                    var docs = existingElements.Descendants(ns + "documentation").ToList();
                    if (docs.Any())
                    {
                        docs.ForEach(d => 
                        {
                            d.Value += string.Join(Environment.NewLine, e.Descendants(ns + "documentation").Select(d2 => d2.Value));
                        });
                    }
                    else
                    {
                        existingElements.ForEach(ee => ee.Remove());
                        controlType.Add(e);
                    }
                }
                else
                {
                    controlType.Add(e);
                }
            }
        }

        private static XElement[] GetAttributes(IEnumerable<string> attributeNames, string tagName)
        {
            return attributeNames
                .Select(an => new XElement(ns + "attribute",
                    GetDocumentationNodeFromName(tagName, an),
                    new XAttribute("name", an),
                    new XAttribute("type", "text")))
                .ToArray();
        }

        private static XElement GetStyleRelatedTag()
        {
            const string SetterComment = "<Setter Property=\"Foreground\" Value=\"Blue\"/>";
            const string StyleComment = "<Style BasedOn=\"{StaticResource {x:Type TextBlock}}\" TargetType=\"TextBlock\" />";

            var anyElement = new XElement(ns + "any", new XAttribute("minOccurs", "0"), new XAttribute("maxOccurs", "unbounded"), new XAttribute("processContents", "lax"));
            var setterElement = new XElement(ns + "element", new XAttribute("name", "Setter"), new XAttribute("minOccurs", "0"), new XAttribute("maxOccurs", "unbounded"));
            setterElement.Add(new XElement(ns + "annotation", new XElement(ns + "documentation", SetterComment)));
            setterElement.Add(new XElement(ns + "complexType", new XElement(ns + "sequence", anyElement),
                GetAttributes(new [] {"Property", "Value"}, "Setter"), new XAttribute("mixed", "true")));
            var sequence = new XElement(ns + "sequence");
            sequence.Add(setterElement);
            var complexType = new XElement(ns + "complexType", new XAttribute("mixed", "true"));
            complexType.Add(sequence);
            complexType.Add(GetAttributes(new [] {"TargetType", "BasedOn"}, "Style"));
            var element = new XElement(ns + "element", new XAttribute("name", "Style"));            
            element.Add(new XElement(ns + "annotation", new XElement(ns + "documentation", StyleComment)));
            element.Add(complexType);
            return element;
        }

        private static XElement[] GetSimpleTypes()
        {
            var restriction = new XElement(ns + "restriction", new XAttribute("base", "xs:string"));
            var simpleType = new XElement(ns + "simpleType", new XAttribute("name", "text"));
            simpleType.Add(restriction);

            return new[]{ simpleType };
        }

        private static PropertyInfo[] GetAllControlProperties(this Type controlType)
        {
            return controlType.GetProperties();
        }

        private static XElement[] GetDocumentationNodeFromName(params string[] entityNames)
        {
            if (XmlDocumentation == null)
            {
                XmlDocumentation = GetDocumentation();
            }

            entityNames = entityNames
                .Where(n => !string.IsNullOrWhiteSpace(n))
                .Select(n => n.Split(new[] { "`" }, StringSplitOptions.None).First())
                .ToArray();

            return XmlDocumentation.Descendants("member")
                .Where(e => e.Attributes("name").Any(a => a.Value.EndsWith($".{string.Join(".", entityNames)}")))
                .SelectMany(e => e.Elements("summary"))
                .Select(e => new XElement(ns + "annotation", 
                    new XElement(ns + "documentation", 
                        Regex.Replace(e.Nodes().Aggregate("", (b, node) => b += node.ToString()).Trim().Replace("<see cref=","").Replace("/>","")
                            , @"\s+", " "))))                
                .Take(1)
                .ToArray();
        }

        private static XDocument GetDocumentation()
        {
            var resourceAssembly = Assembly.GetExecutingAssembly();
            var aaa = resourceAssembly.GetManifestResourceNames();
            Stream resource = resourceAssembly.GetManifestResourceStream(resourceAssembly.GetManifestResourceNames().First(n => n.EndsWith("Wpf.Controls.xml")));
            return XDocument.Load(resource);
        }
    }
}