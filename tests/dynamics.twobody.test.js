import { vallado, rv2period, rv2ecc, rv2coe, coe2mee } from '../src/engine/dynamics/twobody';
import { Cartesian3 } from 'cesium';

describe('twobody', () => {

    const mu = 398600441800000.0
    const numiter = 350;
    const eps = 1e-14;

    const ro1 = new Cartesian3(-605792.21660, -5870229.51108, 3493053.19896);
    const vo1 = new Cartesian3(-1568.25429, -3702.34891, -6479.48395);

    const ro2 = new Cartesian3(-27739093.33242799, -2692255.908557946, 9510190.36914625);
    const vo2 = new Cartesian3(-1886.889113303305, -2370.850540911774, 5779.199448104134);

    test('should calculate classical orbital elements (COE) correctly', () => {

        // expected output from Vallado's MATLAB code
        const expectedCOE1 = [6860755.382175609, 0.00106398573767354, 1.704346105050908, 1.388357215174171, 1.463640333262393, 1.138182142500424]
        const ecc1 = rv2ecc(mu, ro1, vo1);

        expect(ecc1).toBeCloseTo(expectedCOE1[1], 16);

        const coe1 = rv2coe(mu, ro1, vo1);
        for (let i = 0; i < expectedCOE1.length; i++) {
            expect(coe1[i]).toBeCloseTo(expectedCOE1[i], 8);
        }

        // expected output from Vallado's MATLAB code
        const expectedCOE2 = [60209040.44608618, 1.828267146948679, 1.168288532142409, 3.092545852463909, 5.679218487096275, 0.9626133035303527]

        const ecc2 = rv2ecc(mu, ro2, vo2);

        expect(ecc2).toBeCloseTo(expectedCOE2[1], 15);

        const coe2 = rv2coe(mu, ro2, vo2);
        for (let i = 0; i < expectedCOE2.length; i++) {
            expect(coe2[i]).toBeCloseTo(expectedCOE2[i], 7);
        }

    });

    test('should calculate period correctly', () => {

        const period1 = rv2period(mu, ro1, vo1);
        expect(period1).toEqual(5655.481947582134);

        const period2 = rv2period(mu, ro2, vo2);
        expect(period2).toEqual(Infinity);


    });

    test('should propagate state vectors correctly with vallado', () => {

        // expected output from Vallado's MATLAB code
        const expected1 = [
            [0.000000, -605792.21660, -5870229.51108, 3493053.19896, -1568.25429, -3702.34891, -6479.48395],   
            [100.000000, -758555.4463362538, -6203466.893758777, 2824876.750810726, -1483.867999040342, -2955.575042487661, -6870.259019787754],   
            [200.000000, -901956.1128556451, -6460136.593939571, 2121833.059044098, -1381.198105504367, -2172.577951076066, -7176.119453441225],   
            [300.000000, -1034228.052129311, -6637097.765837283, 1392608.524186409, -1261.524706473484, -1363.049809721384, -7393.346693229219],   
            [400.000000, -1153743.673667741, -6732195.53012057, 646206.6962940264, -1126.336212969514, -536.9972302222072, -7519.322362378448],   
            [500.000000, -1259033.862670426, -6744286.208524212, -108163.3263233257, -977.3103695176321, 295.3833297589385, -7552.557585076086],   
            [600.000000, -1348805.870006935, -6673250.003263706, -861200.7246550606, -816.2930373648267, 1123.831813508904, -7492.708171724797],   
            [700.000000, -1421958.980593706, -6519991.034983227, -1603627.59630089, -645.2750286978664, 1938.150886645825, -7340.575638706167],   
            [800.000000, -1477597.780396711, -6286424.809456524, -2326302.991844825, -466.3672970439768, 2728.3307868001, -7098.094208396757],   
            [900.000000, -1515042.87350481, -5975453.335415966, -3020334.962604705, -281.7748021977468, 3484.671207606494, -6768.304102113709],   
            [1000.000000, -1533838.933023138, -5590928.261994528, -3677189.271221133, -93.76937669297138, 4197.898791281262, -6355.311594349327],   
        ]

        for (let i = 0; i < expected1.length; i++) {
            const result = vallado(mu, ro1, vo1, expected1[i][0], numiter);
            expect(Cartesian3.equalsEpsilon(result.position, new Cartesian3(expected1[i][1], expected1[i][2], expected1[i][3]), eps)).toEqual(true);
            expect(Cartesian3.equalsEpsilon(result.velocity, new Cartesian3(expected1[i][4], expected1[i][5], expected1[i][6]), eps)).toEqual(true);
        }

        // expected output from Vallado's MATLAB code
        const expected2 = [
            [0.000000, -27739093.33242799, -2692255.908557946, 9510190.36914625, -1886.889113303305, -2370.850540911774, 5779.199448104134],   
            [100.000000, -27925640.55171997, -2929127.51678184, 10087362.95423781, -1844.286813100734, -2366.549379528035, 5764.203273404959],   
            [200.000000, -28107996.3555098, -3165559.699943866, 10663022.0077874, -1803.054305086834, -2362.065629750349, 5748.936491141751],   
            [300.000000, -28286295.76424982, -3401535.250191436, 11237142.70904981, -1763.152330601211, -2357.420053416114, 5733.443286922854],   
            [400.000000, -28460669.85223538, -3637038.95973046, 11809704.47491743, -1724.541270939063, -2352.631902383493, 5717.764262547755],   
            [500.000000, -28631245.72469725, -3872057.473618962, 12380690.61194233, -1687.181403048315, -2347.718994655777, 5701.936644036228],   
            [600.000000, -28798146.5186495, -4106579.150239919, 12950087.98910898, -1651.033119516182, -2342.697791636528, 5685.994488198038],   
            [700.000000, -28961491.42409192, -4340593.929508788, 13517886.73109617, -1616.057116225842, -2337.583475401307, 5669.968885518626],   
            [800.000000, -29121395.72249749, -4574093.208770701, 14084079.93156902, -1582.214550926161, -2332.390025085274, 5653.888157621175],   
            [900.000000, -29277970.83983102, -4807069.726261715, 14648663.38588917, -1549.467175784435, -2327.130291671792, 5637.778047981556],   
            [1000.000000, -29431324.41164294, -5039517.451945264, 15211635.34251756, -1517.777446796277, -2321.816070627477, 5621.661904926118],
        ]

        for (let i = 0; i < expected2.length; i++) {
            const result = vallado(mu, ro2, vo2, expected2[i][0], numiter);
            expect(Cartesian3.equalsEpsilon(result.position, new Cartesian3(expected2[i][1], expected2[i][2], expected2[i][3]), eps)).toEqual(true);
            expect(Cartesian3.equalsEpsilon(result.velocity, new Cartesian3(expected2[i][4], expected2[i][5], expected2[i][6]), eps)).toEqual(true);
        }
    });

    test('should handle zero delta time in vallado', () => {
        const result = vallado(mu, ro1, vo1, 0, numiter);
        
        // Should return original position and velocity for zero delta time
        expect(Cartesian3.equalsEpsilon(result.position, ro1, eps)).toEqual(true);
        expect(Cartesian3.equalsEpsilon(result.velocity, vo1, eps)).toEqual(true);
    });

    test('should handle very small delta time in vallado', () => {
        const smallDt = 1e-12;
        const result = vallado(mu, ro1, vo1, smallDt, numiter);
        
        // For very small time, result should be very close to original
        expect(result.position.x).toBeCloseTo(ro1.x, 6);
        expect(result.position.y).toBeCloseTo(ro1.y, 6);
        expect(result.position.z).toBeCloseTo(ro1.z, 6);
    });

    test('should handle delta time greater than orbital period in vallado', () => {
        // Use a very large delta time that exceeds the orbital period
        const largeDt = 100000; // Large time that should exceed the period
        const result = vallado(mu, ro1, vo1, largeDt, numiter);
        
        // Should still return a valid result
        expect(result.position).toBeDefined();
        expect(result.velocity).toBeDefined();
        expect(isFinite(result.position.x)).toBe(true);
        expect(isFinite(result.position.y)).toBe(true);
        expect(isFinite(result.position.z)).toBe(true);
    });

    test('should handle parabolic orbit in vallado', () => {
        // Create a parabolic orbit (e = 1, sme = 0)
        const rPara = new Cartesian3(7000000, 0, 0);
        const vPara = new Cartesian3(0, Math.sqrt(2 * mu / 7000000), 0); // Escape velocity
        
        const result = vallado(mu, rPara, vPara, 100, numiter);
        
        // Should complete without error
        expect(result.position).toBeDefined();
        expect(result.velocity).toBeDefined();
    });

    test('should handle hyperbolic orbit in vallado', () => {
        // Create a hyperbolic orbit (e > 1)
        const rHyp = new Cartesian3(7000000, 0, 0);
        const vHyp = new Cartesian3(0, 15000, 0); // Hyperbolic velocity
        
        const result = vallado(mu, rHyp, vHyp, 100, numiter);
        
        // Should complete without error
        expect(result.position).toBeDefined();
        expect(result.velocity).toBeDefined();
    });

    test('should handle convergence failure in vallado', () => {
        // Use very few iterations to force convergence failure
        const result = vallado(mu, ro1, vo1, 1000, 1);
        
        // Should still return a result even if convergence fails
        expect(result.position).toBeDefined();
        expect(result.velocity).toBeDefined();
    });

    test('should handle rv2coe edge cases', () => {
        // Test circular equatorial orbit
        const rCircEq = new Cartesian3(7000000, 0, 0);
        const vCircEq = new Cartesian3(0, Math.sqrt(mu / 7000000), 0);
        
        const coeCircEq = rv2coe(mu, rCircEq, vCircEq);
        expect(coeCircEq[1]).toBeCloseTo(0, 10); // eccentricity should be 0
        expect(coeCircEq[2]).toBeCloseTo(0, 10); // inclination should be 0
        
        // Test circular inclined orbit
        const rCircInc = new Cartesian3(7000000, 0, 0);
        const vCircInc = new Cartesian3(0, 0, Math.sqrt(mu / 7000000));
        
        const coeCircInc = rv2coe(mu, rCircInc, vCircInc);
        expect(coeCircInc[1]).toBeCloseTo(0, 10); // eccentricity should be 0
        expect(coeCircInc[2]).toBeCloseTo(Math.PI / 2, 10); // inclination should be 90 degrees
        
        // Test equatorial elliptical orbit
        const rEqEll = new Cartesian3(7000000, 0, 0);
        const vEqEll = new Cartesian3(0, 6000, 0); // Elliptical velocity
        
        const coeEqEll = rv2coe(mu, rEqEll, vEqEll);
        expect(coeEqEll[1]).toBeGreaterThan(0); // eccentricity should be > 0
        expect(coeEqEll[2]).toBeCloseTo(0, 10); // inclination should be 0
    });

    test('should handle rv2coe with custom tolerance', () => {
        const customTol = 1e-6;
        const rTest = new Cartesian3(7000000, 0, 0);
        const vTest = new Cartesian3(0, Math.sqrt(mu / 7000000) + 1e-7, 0); // Slightly non-circular
        
        const coe = rv2coe(mu, rTest, vTest, customTol);
        expect(coe).toHaveLength(6);
    });

    test('should handle rv2coe hyperbolic case', () => {
        const rHyp = new Cartesian3(7000000, 0, 0);
        const vHyp = new Cartesian3(0, 15000, 0); // Hyperbolic velocity
        
        const coeHyp = rv2coe(mu, rHyp, vHyp);
        expect(coeHyp[1]).toBeGreaterThan(1); // eccentricity should be > 1 for hyperbola
    });

    test('should convert COE to MEE correctly', () => {
        const p = 7000000;
        const ecc = 0.1;
        const inc = 0.5;
        const raan = 1.0;
        const argp = 2.0;
        const nu = 0.5;
        
        const mee = coe2mee(p, ecc, inc, raan, argp, nu);
        
        expect(mee).toHaveLength(6);
        expect(mee[0]).toBe(p); // p remains the same
        expect(mee[1]).toBeCloseTo(ecc * Math.cos(raan + argp), 12); // f
        expect(mee[2]).toBeCloseTo(ecc * Math.sin(raan + argp), 12); // g
        expect(mee[3]).toBeCloseTo(Math.tan(inc / 2) * Math.cos(raan), 12); // h
        expect(mee[4]).toBeCloseTo(Math.tan(inc / 2) * Math.sin(raan), 12); // k
        expect(mee[5]).toBeCloseTo(raan + argp + nu, 12); // L
    });

    test('should handle 180 degree inclination error in coe2mee', () => {
        const p = 7000000;
        const ecc = 0.1;
        const inc = Math.PI; // 180 degrees
        const raan = 1.0;
        const argp = 2.0;
        const nu = 0.5;
        
        expect(() => coe2mee(p, ecc, inc, raan, argp, nu)).toThrow();
    });

    test('should handle various eccentricity cases in rv2period', () => {
        // Circular orbit
        const rCirc = new Cartesian3(7000000, 0, 0);
        const vCirc = new Cartesian3(0, Math.sqrt(mu / 7000000), 0);
        const periodCirc = rv2period(mu, rCirc, vCirc);
        expect(periodCirc).toBeCloseTo(2 * Math.PI * Math.sqrt(7000000 ** 3 / mu), 6);
        
        // Elliptical orbit
        const periodEll = rv2period(mu, ro1, vo1);
        expect(isFinite(periodEll)).toBe(true);
        expect(periodEll).toBeGreaterThan(0);
        
        // Parabolic/hyperbolic orbit
        const rPara = new Cartesian3(7000000, 0, 0);
        const vPara = new Cartesian3(0, Math.sqrt(2.1 * mu / 7000000), 0); // Slightly hyperbolic
        const periodPara = rv2period(mu, rPara, vPara);
        expect(periodPara).toBe(Infinity);
    });

    test('should handle various eccentricity cases in rv2ecc', () => {
        // Circular orbit
        const rCirc = new Cartesian3(7000000, 0, 0);
        const vCirc = new Cartesian3(0, Math.sqrt(mu / 7000000), 0);
        const eccCirc = rv2ecc(mu, rCirc, vCirc);
        expect(eccCirc).toBeCloseTo(0, 10);
        
        // Elliptical orbit
        const eccEll = rv2ecc(mu, ro1, vo1);
        expect(eccEll).toBeGreaterThan(0);
        expect(eccEll).toBeLessThan(1);
        
        // Parabolic orbit (approximately)
        const rPara = new Cartesian3(7000000, 0, 0);
        const vPara = new Cartesian3(0, Math.sqrt(2 * mu / 7000000), 0);
        const eccPara = rv2ecc(mu, rPara, vPara);
        expect(eccPara).toBeCloseTo(1, 6);
        
        // Hyperbolic orbit
        const rHyp = new Cartesian3(7000000, 0, 0);
        const vHyp = new Cartesian3(0, 15000, 0);
        const eccHyp = rv2ecc(mu, rHyp, vHyp);
        expect(eccHyp).toBeGreaterThan(1);
    });
});
