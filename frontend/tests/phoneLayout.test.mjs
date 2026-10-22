import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {requirementBlocks} from '../services/requirementBlocks.ts';
import {homeNextStep, compassDirectionIndex, compassHomeLayout} from '../services/homeNavigation.ts';
const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');

test('requirements preserve wording, scores, decimals and selection caveats', () => {
    const source = 'You need a GPA of 6.0. Entry is limited. Qualification NCEA Score required 200 Qualification CIE Score required 200 Qualification IB Score required 28';
    const blocks = requirementBlocks(source);
    assert.equal(blocks.length, 5);
    assert.equal(blocks.join(' '), source);
    assert.deepEqual(requirementBlocks(null), []);
    assert.deepEqual(requirementBlocks('First condition\r\nSecond condition'), ['First condition','Second condition']);
});
test('custom-header catalogue/career/progression roots protect the top safe area', () => {
    for (const path of ['ProgrammesScreen','ProgrammeDetailsScreen','ProgressionScreen','ProfileScreen','EditProfileScreen','OnboardingScreen','RecommendationsScreen','career-alignment/CareerAlignmentScreen','career-alignment/CareerDetailsScreen','career-alignment/CareersExplorerScreen','career-alignment/SavedScreen']) {
        const source=read('screens/'+path+'.tsx');
        assert.match(source,/react-native-safe-area-context/);
        assert.match(source,/<SafeAreaView edges=\{\['top','left','right'\]\}/);
    }
});
test('login avoids keyboard and supports moving focus to password', () => {
    const source=read('screens/LoginScreen.tsx');
    assert.match(source,/keyboardVerticalOffset=\{headerHeight\}/);
    assert.match(source,/<SafeAreaView edges=\{\['top','left','right','bottom'\]\}/);
    assert.match(source,/passwordInput.current\?\.focus\(\)/);
    assert.match(source,/keyboardDismissMode="interactive"/);
});
test('header has touch targets and a non-overlapping flexible title', () => {
    const source=read('components/PageHeader.tsx');
    assert.match(source,/minWidth: 44, minHeight: 44/);
    assert.doesNotMatch(source,/paddingTop: insets.top/);
    // Decorations may be absolute; the title and its card must stay in flow.
    assert.doesNotMatch(source.match(/titleCard: \{[^\n]+/)[0],/position: "absolute"/);
    assert.doesNotMatch(source.match(/title: \{[^\n]+/)[0],/position: "absolute"/);
});

test('reviewed teammate layouts retain catalogue descriptions and source caveats', () => {
    assert.match(read('screens/career-alignment/CareerDetailsScreen.tsx'),/\{career.description\}/);
    assert.match(read('screens/ProgrammeDetailsScreen.tsx'),/programme.career_pathways/);
    const requirements=read('components/RequirementSource.tsx');
    for(const component of ['EntryRequirements','ClinicalEntryRequirements']) {
        assert.match(read('components/'+component+'.tsx'), /<RequirementSource text=\{text\}/);
    }
    assert.match(requirements,/Scores alone may not guarantee entry/);
    assert.match(requirements,/Source wording is retained/);
    assert.match(requirements,/accessibilityState=\{\{expanded: showAll\}\}/);
    assert.match(requirements,/blocks.map\(/);
});

test('guest bookmark prompt opens login and supports cancel/back', () => {
    const popup=read('components/SignInPopup.tsx');
    assert.match(popup,/navigation.navigate\("Login"\)/);
    assert.doesNotMatch(popup,/navigation.navigate\("Profile"\)/);
    assert.match(popup,/onRequestClose=\{onClose\}/);
    assert.match(popup,/accessibilityRole="button" style=\{styles.cancelButton\} onPress=\{onClose\}/);
    for(const screen of ['ProgrammesScreen','ProgrammeDetailsScreen','career-alignment/CareersExplorerScreen','career-alignment/CareerDetailsScreen']) {
        const source=read('screens/'+screen+'.tsx');
        assert.match(source,/if \(!token\) \{ setShowSignIn\(true\); return; \}/);
        assert.match(source,/<SignInPopup visible=\{showSignIn\}/);
    }
});

test('Kaitlyn compass home opens features directly and the menu replaces Dashboard', () => {
    const home=read('screens/HomeScreen.tsx');
    assert.match(home,/<Compass size=/);
    assert.match(home,/Platform.OS === "web" \? webPointerHandlers : panResponder.panHandlers/);
    assert.match(home,/setPointerCapture\(pointer.pointerId\)/);
    assert.match(home,/<SideBar visible=\{menuOpen\}/);
    assert.match(home,/accessibilityLabel="Open menu"/);
    assert.doesNotMatch(home,/navigate\("Dashboard"\)|Math.random\(|ResultCard/);
    assert.match(home,/Welcome,/);
    assert.match(home,/Find your direction/);
    assert.match(home,/Tap to open compass/);
    assert.match(home,/Choose an option · tap the compass to close/);
    assert.match(home,/onPress=\{\(\) => chooseFeature\(FEATURES\[/);
    assert.match(home,/openFeature\(feature\)/);
    assert.match(home,/YOUR NEXT STEP/);
    assert.match(home,/homeNextStep\(Boolean\(auth\)/);
    assert.doesNotMatch(home,/lucide-react-native|<CompassMenu|navigate\("ChoosePathway"\)/);
    for(const route of ['CareerAlignment','Progression','StudyGroups','Wayfinder']) assert.match(home,new RegExp(`navigate\\("${route}"\\)`));
    for(const title of ['Career Alignment','Milestones','Study Groups','Wayfinder']) assert.match(home,new RegExp(title));
    assert.match(home,/paddingBottom: 96 \+ insets.bottom/);
    assert.match(home,/\[activeCompassSize, reduceMotion\]/);
    assert.match(home,/locationY - activeCompassSize \/ 2/);
    assert.match(home,/pointerEvents=\{isSpinning \? "none" : "box-none"\}/);
    const tabs=read('components/NavBar.tsx');
    for(const label of ['Home','Saved','Wayfinder','Messages','Profile']) assert.match(tabs,new RegExp(`label:'${label}'`));
    assert.doesNotMatch(tabs,/route:'CareerAlignment'|route:'Progression'|route:'StudyGroups'/);
    assert.match(tabs,/currentRoute=useRoute\(\).name/);
    assert.match(tabs,/accessibilityRole="tablist"/);
    assert.match(tabs,/aria-selected=\{selected\}/);
    assert.match(home,/isReduceMotionEnabled/);
    assert.match(home,/if \(!finished\) return/);
    assert.match(read('navigation/AppNavigator.tsx'),/name="CareerExplorer"[\s\S]*?headerShown: false/);
    assert.match(read('navigation/AppNavigator.tsx'),/name="Saves"[^\n]+headerShown:false/);
});

test('next-step shortcuts use only available saved data and are guest-safe', () => {
    assert.equal(homeNextStep(false, 3, 2).route, 'Programmes');
    assert.equal(homeNextStep(true, 0, 0).route, 'Recommendations');
    assert.deepEqual([homeNextStep(true, 1, 3).route, homeNextStep(true, 1, 3).tab], ['Saves','Programmes']);
    assert.deepEqual([homeNextStep(true, 0, 3).route, homeNextStep(true, 0, 3).tab], ['Saves','Careers']);
});

test('drag direction is deterministic across full rotations and rejects invalid angles', () => {
    for(const [angle,index] of [[0,0],[90,1],[180,2],[270,3],[-90,3],[360,0],[450,1],[44,0],[46,1]]) assert.equal(compassDirectionIndex(angle),index);
    for(const angle of [NaN,Infinity,-Infinity]) assert.equal(compassDirectionIndex(angle),null);
});

test('compass labels clear the dial and its glow at narrow, wide and short sizes', () => {
    for (const width of [320, 375, 390, 460, 640, 1280]) {
        for (const height of [480, 740, 844, 1000]) {
            for (const fontScale of [1, 1.3, 1.5, 2, 3]) {
                const layout = compassHomeLayout(width, height, fontScale);
                const dialTop = (layout.openedHeight - layout.openedCompassSize) / 2 - layout.dialGlow;
                const northBottom = layout.edgeInset + layout.featureStackHeight;
                const southTop = layout.openedHeight - layout.edgeInset - layout.featureStackHeight;
                const dialBottom = (layout.openedHeight + layout.openedCompassSize) / 2 + layout.dialGlow;
                assert.ok(dialTop - northBottom >= layout.clearance);
                assert.ok(southTop - dialBottom >= layout.clearance);
                assert.ok(layout.openedCompassSize > 0);
                assert.ok(layout.openedCompassSize + 14 < layout.featureAreaWidth);
            }
        }
    }
    const home = read('screens/HomeScreen.tsx');
    assert.match(home, /compassHomeLayout\(width, height - insets.top - insets.bottom, fontScale\)/);
    assert.match(home, /position === "top" && label/);
    assert.match(home, /styles.compassHalo, \{width: haloSize, height: haloSize, borderRadius: haloSize \/ 2\}/);
    assert.doesNotMatch(home, /styles.compassPanel|opacity: featuresOpacity, transform/);
    // Animate icons in place, not the whole layout: labels must not fly into the dial.
    assert.match(home, /transform: \[\{scale\}\]/);
});

test('compass closes with a cancellable reduced-motion-aware animation before hiding options', () => {
    const home = read('screens/HomeScreen.tsx');
    const close = home.slice(home.indexOf('function closeCompass()'), home.indexOf('function showFeatures()'));
    assert.match(close, /if \(busy.current\) return/);
    assert.match(close, /setIsClosing\(true\)/);
    assert.match(close, /Animated.parallel\(/);
    assert.match(close, /toValue: 0, duration: reduceMotion \? 0 : 200/);
    assert.match(close, /currentAngle.current - 180/);
    assert.match(close, /if \(!finished\) return;[\s\S]*setExpanded\(false\)/);
    assert.match(home, /if \(expanded\) \{\s*closeCompass\(\);/);
    assert.match(home, /Closing your compass/);
    assert.match(home, /closing \? "Compass closing"/);
    assert.match(home, /setIsClosing\(false\)/);
});

test('UoA Health branding and square launcher asset keep the existing install/update identity', () => {
    const config = JSON.parse(read('app.json')).expo;
    assert.equal(config.name, 'UoA Health');
    assert.equal(config.slug, 'frontend');
    assert.equal(config.ios.bundleIdentifier, 'com.avinashrajaram.cs399wayfinder');
    assert.equal(config.android.package, config.ios.bundleIdentifier);
    assert.equal(config.extra.eas.projectId, 'b7655ad4-e3f3-495b-8878-7e8956b36dcf');
    assert.equal(config.icon, './assets/uoa-health-icon.png');
    assert.equal(config.android.adaptiveIcon.foregroundImage, config.icon);
    assert.equal(config.web.favicon, config.icon);
    const png = readFileSync(new URL('../assets/uoa-health-icon.png', import.meta.url));
    assert.equal(png.readUInt32BE(16), png.readUInt32BE(20));
    assert.ok(png.readUInt32BE(16) >= 1024);
    for (const path of ['screens/HomeScreen.tsx', 'screens/LoginScreen.tsx', 'components/SideBar.tsx', 'screens/settings/AboutScreen.tsx']) {
        assert.match(read(path), /BrandWordmark/);
        assert.match(read(path), /BrandLogo/);
        assert.doesNotMatch(read(path), /Student Compass|Undergraduate Health Study App/);
    }
    assert.match(read('components/BrandLogo.tsx'), /APP_NAME/);
    assert.match(read('components/BrandLogo.tsx'), /uoa-health-mark-transparent\.png/);
});
