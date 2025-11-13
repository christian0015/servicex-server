// controllers/seedController.js
const DataSeeder = require('../scripts/seedData');

class SeedController {
  async generateFakeData(req, res) {
    try {
      const { secret } = req.body;
      
      // Protection basique
      // if (secret.value != process.env.SEED_SECRET) {
      //   console.log(secret, "r ", process.env.SEED_SECRET );
        
      //   return res.status(403).json({
      //     success: false,
      //     message: 'Accès non autorisé'
      //   });
      // }

      const seeder = new DataSeeder();
      await seeder.generateFakeData();

      res.json({
        success: true,
        message: 'Données fictives générées avec succès'
      });

    } catch (error) {
      console.error('❌ Erreur génération données:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la génération des données'
      });
    }
  }

  async deleteFakeData(req, res) {
    try {
      const { secret } = req.body;
      
      if (secret !== process.env.SEED_SECRET) {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé'
        });
      }

      const seeder = new DataSeeder();
      await seeder.deleteFakeData();

      res.json({
        success: true,
        message: 'Données fictives supprimées avec succès'
      });

    } catch (error) {
      console.error('❌ Erreur suppression données:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression des données'
      });
    }
  }
}

module.exports = new SeedController();