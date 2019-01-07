using System;
using System.Linq;
using System.Xml.Linq;
using System.Reflection;
using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Globalization;

namespace Wpf {
    public static class Program
    {
        private static XNamespace ns = "http://www.w3.org/2001/XMLSchema";

        private static Regex alphanumeric = new Regex("[^a-zA-Z0-9 -]");

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
                new XAttribute(XNamespace.Xmlns + "xs", "http://www.w3.org/2001/XMLSchema"));

            root.Add(GetSimpleTypes());
            root.Add(GetBaseControlType(baseControl.Value));
            root.Add(GetControlGroup(controlsWithAttributes.Keys));
            root.Add(controlsWithAttributes.Select(c => GetControlElement(c.Key, c.Value, baseControl.Value)).ToArray());

            var document = new XDocument();
            document.Add(root);
            document.Save("Wpf.xsd");
        }

        private static XElement GetControlElement(string controlName, IEnumerable<string> controlAttributes, IEnumerable<string> baseAttributeNames)
        {
            var extension = new XElement(ns + "extension", new XAttribute("base", "FrameworkElement"));
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
            var anyAttribute = new XElement(ns + "anyAttribute", new XAttribute("namespace", "##local http://schemas.microsoft.com/winfx/2006/xaml http://schemas.openxmlformats.org/markup-compatibility/2006"), new XAttribute("processContents", "skip"));

            var choice = new XElement(ns + "choice", new XAttribute("minOccurs", "0"), new XAttribute("maxOccurs", "unbounded"));
            choice.Add(group, any);
            var complexType = new XElement(ns + "complexType", new XAttribute("name", "FrameworkElement"), new XAttribute("mixed", "true"));
            complexType.Add(choice);
            complexType.Add(GetAttributes(controlAttributes));
            complexType.Add(anyAttribute);
            return complexType;
        }
        private static XElement[] GetAttributes(IEnumerable<string> attributeNames)
        {
            return attributeNames
                .Select(an => new XElement(ns + "attribute", new XAttribute("name", an), new XAttribute("type", "text")))
                .ToArray();
        }

        private static XElement[] GetTagAttributes(string tagName, IEnumerable<string> attributeNames, IEnumerable<string> baseAttributeNames)
        {
            return attributeNames
                .Concat(baseAttributeNames)
                .Where(an => an.EndsWith("Styles", false, CultureInfo.InvariantCulture))
                .Select(an => new XElement(ns + "element", new XAttribute("name", $"{tagName}.{an}"), new XAttribute("minOccurs", "0"), new XAttribute("maxOccurs", "1")))
                .Select(xe =>
                {
                    xe.Add(new XElement(ns + "complexType",
                        new XElement(ns + "sequence", new XElement(ns + "any", new XAttribute("maxOccurs", "unbounded"), new XAttribute("processContents", "lax"))),
                        new XElement(ns + "anyAttribute", new XAttribute("processContents", "lax"))
                        ));
                    return xe;
                })
                .ToArray();
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