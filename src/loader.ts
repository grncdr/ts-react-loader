import Ast, {
  ClassDeclaration,
  Type,
  TypeNode,
  TypeReferenceNode,
  InterfaceMemberTypes,
  Symbol
} from "ts-simple-ast";
import {
  preProcessFile,
  SymbolFlags,
  LiteralType,
  ArrayTypeNode
} from "typescript";

export default function propTyper(this: any, source: string) {
  this.cacheable && this.cacheable();

  const ast = new Ast();

  if (ast.getSourceFile(this.resourcePath)) {
    ast.removeSourceFile(this.resourcePath);
  }

  const info = preProcessFile(source, true, false);
  info.importedFiles.forEach(ref => {
    this.addDependency(ref.fileName);
  });

  const sourceFile = ast.addSourceFileFromText(this.resourcePath, source);
  const propTypesImport = sourceFile.getImport(
    i =>
      i.getModuleSpecifier() === "prop-types" && Boolean(i.getNamespaceImport())
  );

  const importName = propTypesImport
    ? propTypesImport.getNamespaceImport().getText()
    : "PropTypes";

  let needPropTypesImport = false;

  const classes = sourceFile.getClasses().forEach(classDecl => {
    const generator = new PropTypeGenerator(ast, importName, classDecl);

    const propsType = getPropsType(classDecl);

    if (propsType && !classDecl.getStaticMember("propTypes")) {
      needPropTypesImport = true;
      classDecl.addProperty({
        isStatic: true,
        name: "propTypes",
        initializer: generator.fromTypeNode(propsType)
      });
    }

    const contextType = getContextType(classDecl);
    if (contextType && !classDecl.getStaticMember("contextTypes")) {
      needPropTypesImport = true;

      classDecl.addProperty({
        isStatic: true,
        name: "contextTypes",
        initializer: generator.fromTypeNode(contextType)
      });
    }
  });

  if (needPropTypesImport && !propTypesImport) {
    sourceFile.addImport({
      moduleSpecifier: "prop-types",
      namespaceImport: "PropTypes"
    });
  }

  return sourceFile.getFullText();
}

function isReactComponent(c: ClassDeclaration): boolean {
  const ex = c.getExtends();
  if (!ex) {
    return false;
  }
  if (ex.getExpression().getText() === "React.Component") {
    return true;
  }
  return;
}

function getPropsType(c: ClassDeclaration): TypeNode | undefined {
  const ex = c.getExtends();
  if (!ex) {
    return undefined;
  }
  if (ex.getExpression().getText() !== "React.Component") {
    return undefined;
  }
  return ex.getTypeArguments()[0];
}

function getContextType(c: ClassDeclaration): TypeNode | undefined {
  const p = c.getInstanceProperty("context");
  if (p) {
    return (p as any).getTypeNode();
  }
  return undefined;
}

class PropTypeGenerator {
  private typeParents: Type[];

  constructor(
    private ast: Ast,
    private importName: string,
    private classDecl: ClassDeclaration
  ) {
    this.typeParents = [];
  }

  public fromTypeNode(typeNode: TypeNode): string {
    const checker = this.ast.getTypeChecker();
    const name = typeNode.getKindName();
    const type = checker.getTypeAtLocation(typeNode);
    this.typeParents.push(type);
    const map = this.validationMap(type.getProperties());
    this.typeParents.pop();
    return map;
  }

  /** re-used by propType below */
  private validationMap(properties: Symbol[]) {
    const shape = "__shape$" + this.typeParents.length;
    const strings = properties.map(prop => {
      const typeNode = (prop.getDeclarations()[0] as any).getTypeNode();
      let typeString = "";
      if (typeNode.getText() === "React.ReactNode") {
        typeString = this.importName + ".node";
      } else {
        typeString = this.propType(prop.getTypeAtLocation(this.classDecl));
      }
      const optional = prop.hasFlags(SymbolFlags.Optional);
      return (
        shape +
        "." +
        prop.getName() +
        " = " +
        typeString +
        (optional ? "" : ".isRequired")
      );
    });
    return `(function(){
      const ${shape}: ${this.importName}.ValidationMap<any> = {}
      ${strings.join("\n")}
      return ${shape}
    }())`;
  }

  private propType(type: Type) {
    const circularParent = this.typeParents.findIndex(
      parent => parent.compilerType === type.compilerType
    );
    if (circularParent >= 0) {
      return this.importName + ".shape(__shape$" + (circularParent + 1) + ")";
    }

    if (type.isBooleanType()) {
      // booleans are also considered a union type of `true | false`, so this check needs to come first
      return this.importName + ".bool";
    }

    if (type.isUnionType()) {
      if (
        type
          .getUnionTypes()
          .every(
            t => typeof (t.compilerType as LiteralType).value !== "undefined"
          )
      ) {
        // special case: union of literal types
        const values = type
          .getUnionTypes()
          .map(t => (t.compilerType as LiteralType).value);
        return this.importName + ".oneOf(" + JSON.stringify(values) + ")";
      }

      this.typeParents.push(type);
      const members = type.getUnionTypes().map(member => this.propType(member));
      this.typeParents.pop();
      return this.importName + ".oneOfType([" + members.join(", ") + "])";
    }
    if (type.isIntersectionType()) {
      // PropTypes doesn't support intersections
      return this.importName + ".any";
    }
    if (type.getCallSignatures().length > 0) {
      return this.importName + ".func";
    }
    if ("intrinsicName" in type.compilerType) {
      const intrinsicName = (type.compilerType as any).intrinsicName;
      switch (intrinsicName) {
        case "true":
        case "false":
          return this.importName + ".bool";
        case "unknown":
          return this.importName + ".any";
        default:
          return this.importName + "." + intrinsicName;
      }
    }
    if (type.isArrayType()) {
      this.typeParents.push(type);
      const elem = type.getArrayType();
      if (elem.isArrayType()) {
        throw new Error("wat");
      }
      const elTy = this.propType(elem);
      this.typeParents.pop();
      return this.importName + ".arrayOf(" + elTy + ")";
    }
    if (type.isInterfaceType() || type.isObjectType()) {
      this.typeParents.push(type);
      const map = this.validationMap(type.getProperties());
      this.typeParents.pop();
      return this.importName + ".shape(" + map + ")";
    }
    return this.importName + ".any";
  }
}
