using System;
using System.Linq;
using System.Xml.Linq;
using System.Reflection;
using Avalonia;
using Avalonia.Controls;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Globalization;

namespace AvaloniaXsd
{
    public static class Program
    {
        private static XNamespace ns = "http://www.w3.org/2001/XMLSchema";

        private static Regex alphanumeric = new Regex("[^a-zA-Z0-9 -]");

        public static void Main(string[] args)
        {
            Func<string, bool> isAlphanumeric = str => !alphanumeric.IsMatch(str);

            var assembly = Assembly.GetAssembly(typeof(Control));
            var controlsWithAttributes = assembly.GetExportedTypes()
                .Where(t => !t.IsAbstract && t.FullName.StartsWith("Avalonia.Controls") && typeof(Control).IsAssignableFrom(t) && isAlphanumeric(t.Name))
                .ToDictionary(t => t.Name, t => t.GetProperties().Where(p => isAlphanumeric(p.Name)).Select(p => p.Name).Distinct().ToList());

            var baseControl = controlsWithAttributes.First(c => c.Key == typeof(Control).Name);
            controlsWithAttributes.Remove(typeof(Control).Name);

            foreach (var ca in controlsWithAttributes)
            {
                ca.Value.RemoveAll(c => baseControl.Value.Contains(c));
            }

            XElement root = new XElement(ns + "schema",
                new XAttribute("id", "AvaloniaXamlSchema"),
                new XAttribute("targetNamespace", "https://github.com/avaloniaui"),
                new XAttribute("elementFormDefault", "qualified"),
                new XAttribute("xmlns", "https://github.com/avaloniaui"),
                new XAttribute(XNamespace.Xmlns + "xs", "http://www.w3.org/2001/XMLSchema"));

            root.Add(GetSimpleTypes());
            root.Add(GetBaseControlType(baseControl.Value));
            root.Add(GetControlGroup(controlsWithAttributes.Keys));
            root.Add(controlsWithAttributes.Select(c => GetControlElement(c.Key, c.Value, baseControl.Value)).ToArray());
            root.Add(GetStyleRelatedTag());

            var document = new XDocument();
            document.Add(root);
            document.Save("AvaloniaXamlSchema.xsd");
        }

        private static XElement GetControlElement(string controlName, IEnumerable<string> controlAttributes, IEnumerable<string> baseAttributeNames)
        {
            var extension = new XElement(ns + "extension", new XAttribute("base", "Control"));
            extension.Add(GetAttributes(controlAttributes));
            var complexContent = new XElement(ns + "complexContent");
            complexContent.Add(extension);
            var complexType = new XElement(ns + "complexType", new XAttribute("mixed", "true"));
            complexType.Add(complexContent);
            var element = new XElement(ns + "element", new XAttribute("name", controlName));
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

            var choice = new XElement(ns + "choice", new XAttribute("minOccurs", "0"), new XAttribute("maxOccurs", "unbounded"));
            choice.Add(group, any);
            var complexType = new XElement(ns + "complexType", new XAttribute("name", "Control"), new XAttribute("mixed", "true"));
            complexType.Add(choice);
            complexType.Add(GetAttributes(controlAttributes));
            return complexType;
        }
        private static XElement[] GetAttributes(IEnumerable<string> attributeNames)
        {
            return attributeNames
                .Select(an => new XElement(ns + "attribute", new XAttribute("name", an), new XAttribute("type", "text")))
                .ToArray();
        }

        private static XElement GetStyleRelatedTag()
        {
            const string SetterComment = "<Setter Property=\"Foreground\" Value=\"Blue\"/>";
            const string StyleComment = "<Style Selector=\"TextBlock.h1.h2\" />\n<Style Selector=\"Button.red:focus\" />\n<Style Selector=\"StackPanel &gt; Button.foo\" />";
            var anyElement = new XElement(ns + "any", new XAttribute("minOccurs", "0"), new XAttribute("maxOccurs", "unbounded"), new XAttribute("processContents", "lax"));

            var setterElement = new XElement(ns + "element", new XAttribute("name", "Setter"), new XAttribute("minOccurs", "0"), new XAttribute("maxOccurs", "unbounded"));
            setterElement.Add(new XElement(ns + "annotation", new XElement(ns + "documentation", SetterComment)));
            setterElement.Add(new XElement(ns + "complexType", new XElement(ns + "sequence", anyElement),
                GetAttributes(new [] {"Property", "Value"}), new XAttribute("mixed", "true")));
            var sequence = new XElement(ns + "sequence");
            sequence.Add(setterElement);
            var complexType = new XElement(ns + "complexType", new XAttribute("mixed", "true"));
            complexType.Add(sequence);
            complexType.Add(GetAttributes(new [] {"Selector"}));
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
    }
}
