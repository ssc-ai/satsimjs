import { Matrix4, Cartesian3 } from 'cesium';
import { Node, Group, TransformGroup, Graph } from '../src/index';

describe('Graph Tests', () => {
    const eps = 1e-14;
    let root;
    let group;
    let tg;
    let child;
    let child2;
    let tg2;
    let tg3;
    let child3;
    let allNodes;
    let set1Nodes;
    let set2Nodes;

    beforeEach(() => {
        root = new TransformGroup('root');
        group = new Group('group');
        tg = new TransformGroup('tg');
        child = new Node('child');
        child2 = new Node('child2');
        tg2 = new TransformGroup('tg2');
        tg3 = new TransformGroup('tg3');
        child3 = new Node('child3');

        allNodes = [root, group, tg, child, child2, tg2, tg3, child3];
        set1Nodes = [root, group, tg3, child];
        set2Nodes = [tg, child2, tg2, child3] ;  
    });

    test('hasChildren() method', () => {
        expect(root.hasChildren()).toBe(false);
        root.addChild(group);
        expect(root.hasChildren()).toBe(true);
        root.removeChild(group);
        expect(root.hasChildren()).toBe(false);
        root.addChild(group);
        expect(root.hasChildren()).toBe(true);
        root.addChild(tg);
        expect(root.hasChildren()).toBe(true);
        root.removeAll();
        expect(root.hasChildren()).toBe(false);
        root.addChild(group);
        expect(root.children[0]).toBe(group);
        expect(group.parent).toBe(root);
    });

    test('localToWorldTransform() method', () => {

        root.addChild(group);
        expect(group.parent).toBe(root);
        root.addChild(tg3);
        expect(tg3.parent).toBe(root);
        group.addChild(tg);
        expect(tg.parent).toBe(group);
        group.addChild(child);
        expect(child.parent).toBe(group);
        tg.addChild(child2);
        expect(child2.parent).toBe(tg);
        tg.addChild(tg2);
        expect(tg2.parent).toBe(tg);
        tg2.addChild(child3);
        expect(child3.parent).toBe(tg2);
        expect(root.parent).toBeNull();

        for (const n of allNodes) {
            expect(n.localToWorldTransform.equals(Matrix4.IDENTITY)).toBe(true);
        }

        root.rotateX(Math.PI);
        const expected = new Matrix4(
            1.0,  0.0,  0.0, 0.0,
            0.0, -1.0,  0.0, 0.0,
            0.0,  0.0, -1.0, 0.0,
            0.0,  0.0,  0.0, 1.0
        );
        for (const n of allNodes) {
            expect(Matrix4.equalsEpsilon(n.localToWorldTransform, expected, eps)).toBe(true);
        }

        root.translate(new Cartesian3(10, 20, 0));
        const expected2 = new Matrix4(
            1.0,  0.0,  0.0,  10.0,
            0.0, -1.0,  0.0, -20.0,
            0.0,  0.0, -1.0,   0.0,
            0.0,  0.0,  0.0,   1.0
        );
        for (const n of allNodes) {
            expect(Matrix4.equalsEpsilon(n.localToWorldTransform, expected2, eps)).toBe(true);
        }

        root.rotateY(Math.PI / 4);
        const S2D2 = Math.sqrt(2) / 2    ;
        const expected3 = new Matrix4(
        S2D2,  0.0,  S2D2,  10.0,
            0.0, -1.0,   0.0, -20.0,
            S2D2,  0.0, -S2D2,   0.0,
            0.0,  0.0,   0.0,   1.0
        );
        for (const n of allNodes) {
            expect(Matrix4.equalsEpsilon(n.localToWorldTransform, expected3, eps)).toBe(true);
        }

        root.translate(new Cartesian3(-20, -10, 20));
        const expected4 = new Matrix4(
            S2D2,  0.0,  S2D2,  10.0,
            0.0, -1.0,   0.0, -10.0,
            S2D2,  0.0, -S2D2, -28.2842712474619,
            0.0,  0.0,   0.0,   1.0
        );
        for (const n of allNodes) {
            expect(Matrix4.equalsEpsilon(n.localToWorldTransform, expected4, eps)).toBe(true);
        }

        expect(group.localTransform.equals(root.localTransform)).toBe(true);
        expect(child.localTransform.equals(root.localTransform)).toBe(true);
        expect(tg.localTransform.equals(Matrix4.IDENTITY)).toBe(true);

        root.rotateZ(-Math.PI / 8);
        const expected5 = new Matrix4(
            0.65328148243818830,  0.27059805007309850,  0.7071067811865475,  10.0,
            0.38268343236508984, -0.92387953251128670,  0                 , -10.0,
            0.65328148243818820,  0.27059805007309856, -0.7071067811865476, -28.2842712474619,
            0.0, 0.0, 0.0, 1.0
        );
        for (const n of allNodes) {
            expect(Matrix4.equalsEpsilon(n.localToWorldTransform, expected5, eps)).toBe(true);
        }

        tg.rotateX(Math.PI / 4);
        const expected6 = new Matrix4(
            0.65328148243818830,  0.6913417161825448,  0.3086582838174551,  10,
            0.38268343236508984, -0.6532814824381884,  0.6532814824381881, -10,
            0.65328148243818820, -0.3086582838174551, -0.6913417161825450, -28.2842712474619,
            0.0, 0.0, 0.0, 1.0
        );
        for (const n of set2Nodes) {
            expect(Matrix4.equalsEpsilon(n.localToWorldTransform, expected6, eps)).toBe(true);
        }
        for (const n of set1Nodes) {
            expect(Matrix4.equalsEpsilon(n.localToWorldTransform, expected5, eps)).toBe(true);
        }

        tg.translate(new Cartesian3(5, -5, 5));
        const expected7 = new Matrix4(
            0.65328148243818830,  0.6913417161825448,  0.3086582838174551,  11.35299025036549,
            0.38268343236508984, -0.6532814824381884,  0.6532814824381881,  -1.5537680137926717,
            0.65328148243818820, -0.3086582838174551, -0.6913417161825450, -26.931280997096408,
            0.0, 0.0, 0.0, 1.0
        );
        for (const n of set2Nodes) {
            expect(Matrix4.equalsEpsilon(n.localToWorldTransform, expected7, eps)).toBe(true);
        }
        for (const n of set2Nodes) {
            expect(Matrix4.equalsEpsilon(n.worldToLocalTransform, Matrix4.inverseTransformation(expected7, new Matrix4()), eps)).toBe(true);
        }
        for (const n of set1Nodes) {
            expect(Matrix4.equalsEpsilon(n.localToWorldTransform, expected5, eps)).toBe(true);
        }

        tg2.translate(new Cartesian3(100, 200, 500));
        const expected8 = new Matrix4(
            0.65328148243818830,  0.6913417161825448,  0.3086582838174551,  369.27862363942086,
            0.38268343236508984, -0.6532814824381884,  0.6532814824381881,  232.69901995417266,
            0.65328148243818820, -0.3086582838174551, -0.6913417161825450, -369.00564760804110,
            0.0, 0.0, 0.0, 1.0
        );
        expect(Matrix4.equalsEpsilon(tg2.localToWorldTransform, expected8, eps)).toBe(true);
        expect(Matrix4.equalsEpsilon(child3.localToWorldTransform, expected8, eps)).toBe(true);
        expect(Matrix4.equalsEpsilon(tg2.worldToLocalTransform, Matrix4.inverseTransformation(expected8, new Matrix4()), eps)).toBe(true);
        expect(Matrix4.equalsEpsilon(child3.worldToLocalTransform, Matrix4.inverseTransformation(expected8, new Matrix4()), eps)).toBe(true);

        expect(root.localTransform.equals(root.transform)).toBe(true);
        expect(group.localTransform.equals(root.localTransform)).toBe(true);
        expect(child.localTransform.equals(root.localTransform)).toBe(true);
        expect(tg3.localTransform.equals(tg3.transform)).toBe(true);
        expect(tg.localTransform.equals(tg.transform)).toBe(true);
        expect(child2.localTransform.equals(tg.localTransform)).toBe(true);
        expect(tg2.localTransform.equals(tg2.transform)).toBe(true);
        expect(child3.localTransform.equals(tg2.localTransform)).toBe(true);
    });
})