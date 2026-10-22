import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {requirementBlocks} from '../services/requirementBlocks.ts';

// Exercise the screen's actual JSX and press handlers without loading native
// modules or making network calls. A programme fixture represents a loaded API.
function screen(file, programme) {
    const states=programme===undefined?[]:[programme];
    let cursor=0;
    const placeholders=new Map();
    const jsx=(type,props)=>({type,props:props??{}});
    const hooks={useEffect(){},useState(initial){
        const index=cursor++;
        if(!(index in states))states[index]=typeof initial==='function'?initial():initial;
        return [states[index],next=>{states[index]=typeof next==='function'?next(states[index]):next;}];
    }};
    const module={exports:{}};
    function require(name){
        if(name==='react')return hooks;
        if(name==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'Fragment'};
        if(name==='react-native')return {View:'View',Text:'Text',TouchableOpacity:'TouchableOpacity',ScrollView:'ScrollView',StyleSheet:{create:value=>value},Linking:{openURL:async()=>{}}};
        if(name==='react-native-safe-area-context')return {SafeAreaView:'SafeAreaView'};
        if(name==='@expo/vector-icons')return {Ionicons:'Ionicons'};
        if(name.endsWith('/requirementBlocks'))return {requirementBlocks};
        if(name.endsWith('/SessionContext'))return {useSession:()=>({auth:null})};
        if(name.endsWith('/SavedContext'))return {useSaved:()=>({isProgrammeSaved:()=>false,toggleProgramme(){},notice:''})};
        if(name.endsWith('/api'))return {getProgramme:async()=>programme};
        if(name.endsWith('/careerAdapter'))return {adaptCareer:career=>career};
        if(name.includes('/components/')){
            if(!placeholders.has(name))placeholders.set(name,()=>null);
            return {__esModule:true,default:placeholders.get(name)};
        }
        throw new Error('Unexpected dependency: '+name);
    }
    const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
    const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
    vm.runInNewContext(output,{module,exports:module.exports,require,URL},{filename:file});
    return {render(props={}){cursor=0;return module.exports.default(props);},placeholders};
}
function nodes(tree){
    if(tree==null||typeof tree==='boolean')return [];
    if(Array.isArray(tree))return tree.flatMap(nodes);
    if(typeof tree!=='object')return [tree];
    return [tree,...nodes(tree.props?.children)];
}
const text=tree=>nodes(tree).filter(node=>typeof node==='string'||typeof node==='number').join(' ');
function press(tree,label){
    const button=nodes(tree).find(node=>typeof node==='object'&&node.props?.onPress&&text(node)===label);
    assert.ok(button,'Missing control: '+label);button.props.onPress();
}
const fixture={id:9,name:'Certificate in Health Sciences CertHSc',faculty:'Health',duration:'One year',description:'Catalogue description',entry_requirements:'A condition',career_pathways:'Catalogue pathway guidance that must remain available.',careers:[]};
const props={route:{params:{programmeId:fixture.id}},navigation:{navigate(){},goBack(){}}};

test('full requirement disclosure retains unmatched conditions, scores and dates after expansion',()=>{
    const requirements='University Entrance (UE) is required.\nQualification NCEA Score required 230\nA portfolio may be requested; applications close 8 December.\nMinimum GPA 6.5 does not guarantee selection.';
    const component=screen('components/RequirementSource.tsx');
    let tree=component.render({text:requirements});
    assert.doesNotMatch(text(tree),/portfolio/);
    press(tree,'Read original requirements');tree=component.render({text:requirements});
    for(const block of requirementBlocks(requirements))assert.ok(text(tree).includes(block));
    assert.equal(nodes(tree).filter(node=>node?.type==='Text'&&node.props.selectable).length,requirementBlocks(requirements).length);
    press(tree,'Hide original requirements');assert.doesNotMatch(text(component.render({text:requirements})),/portfolio/);
});

test('career accordion retains catalogue pathway text when no structured careers exist',()=>{
    const component=screen('screens/ProgrammeDetailsScreen.tsx',fixture);
    let tree=component.render(props);press(tree,'Careers');tree=component.render(props);
    press(tree,'Career Pathways Careers related to this programme');tree=component.render(props);
    assert.ok(text(tree).includes(fixture.career_pathways));
    assert.doesNotMatch(text(tree),/No career suggestions available/);
});

test('career accordion still gives an honest empty state when both career sources are absent',()=>{
    const component=screen('screens/ProgrammeDetailsScreen.tsx',{...fixture,career_pathways:null});
    let tree=component.render(props);press(tree,'Careers');tree=component.render(props);
    press(tree,'Career Pathways Careers related to this programme');tree=component.render(props);
    assert.match(text(tree),/No career suggestions available/);
});

test('both programme layouts expand the course preview with the current programme ID',()=>{
    for(const name of ['Certificate in Health Sciences CertHSc','Bachelor of Pharmacy BPharm']){
        const component=screen('screens/ProgrammeDetailsScreen.tsx',{...fixture,name});
        let tree=component.render(props);press(tree,'Courses');tree=component.render(props);
        const preview=component.placeholders.get('../components/ProgrammeCourses');
        assert.ok(preview);assert.equal(nodes(tree).filter(node=>node?.type===preview).length,0);
        press(tree,'Course Information Explore study plans and milestones');tree=component.render(props);
        const rendered=nodes(tree).filter(node=>node?.type===preview);
        assert.equal(rendered.length,1);assert.equal(rendered[0].props.programmeId,fixture.id);
        assert.equal(rendered[0].props.navigation,props.navigation);
    }
});
