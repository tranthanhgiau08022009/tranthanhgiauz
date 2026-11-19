const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    tokenBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Ma nap tien duy nhat dung lam noi dung chuyen khoan, vi du: NAP4821
    rechargeCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Tu dong sinh ma nap tien NAPxxxxxx (kiem tra trung, thu lai neu trung)
UserSchema.pre('save', async function (next) {
  try {
    if (!this.rechargeCode) {
      const Model = this.constructor;
      for (let i = 0; i < 20 && !this.rechargeCode; i++) {
        const code = 'NAP' + Math.floor(100000 + Math.random() * 900000);
        if (!(await Model.exists({ rechargeCode: code }))) this.rechargeCode = code;
      }
      if (!this.rechargeCode) this.rechargeCode = 'NAP' + Date.now().toString().slice(-8);
    }
    if (this.isModified('password')) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }
    next();
  } catch (err) {
    next(err);
  }
});

UserSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
