"use client";

import { useContext } from "react";
import { DesignContext } from "@/contexts/DesignPresetContext";
import type { IconType } from "react-icons";
import { PiPaletteBold } from "react-icons/pi";
import { LuPalette } from "react-icons/lu";
import { RxColorWheel } from "react-icons/rx";
import { MdPalette } from "react-icons/md";
import {
  PiArrowClockwiseBold,
  PiArrowCounterClockwiseBold,
  PiArrowDownBold,
  PiArrowLeftBold,
  PiArrowRightBold,
  PiArrowSquareOutBold,
  PiArrowUpBold,
  PiArrowsClockwiseBold,
  PiBellBold,
  PiBooks,
  PiBooksBold,
  PiCalendarBold,
  PiCameraRotate,
  PiCameraRotateBold,
  PiCaretDownBold,
  PiCaretUpBold,
  PiChatCircleBold,
  PiChatTextBold,
  PiCheckCircleBold,
  PiCheckCircleFill,
  PiCircleNotchBold,
  PiClipboardTextBold,
  PiClockBold,
  PiCopyBold,
  PiDownloadBold,
  PiEyeBold,
  PiEyeSlashBold,
  PiFileMagnifyingGlassBold,
  PiFileTextBold,
  PiFloppyDisk,
  PiFloppyDiskBold,
  PiGearBold,
  PiGlobeBold,
  PiGraduationCap,
  PiGridNineBold,
  PiGuitar,
  PiGuitarBold,
  PiGuitarFill,
  PiHouseLineBold,
  PiIdentificationCardBold,
  PiImageBold,
  PiInfoBold,
  PiLightbulb,
  PiLightbulbBold,
  PiLinkBold,
  PiLinkSimpleHorizontalBold,
  PiListBold,
  PiListChecks,
  PiListChecksBold,
  PiLockBold,
  PiLockOpenBold,
  PiMagnifyingGlassBold,
  PiMagnifyingGlassMinusBold,
  PiMagnifyingGlassPlusBold,
  PiMapPin,
  PiMapPinBold,
  PiMicrophone,
  PiMicrophoneBold,
  PiMonitorBold,
  PiMoonStarsBold,
  PiMusicNotes,
  PiMusicNotesBold,
  PiNotePencil,
  PiNotePencilBold,
  PiPackageBold,
  PiPaperPlaneTiltBold,
  PiPauseBold,
  PiPencilLineBold,
  PiPencilSimpleBold,
  PiPhone,
  PiPhoneBold,
  PiPlayBold,
  PiPlusBold,
  PiPower,
  PiPowerBold,
  PiPrinter,
  PiPrinterBold,
  PiPushPinBold,
  PiSelectionAllBold,
  PiShield,
  PiShieldBold,
  PiShieldWarning,
  PiShieldWarningBold,
  PiSignOutBold,
  PiSlidersHorizontalBold,
  PiSpeakerHighBold,
  PiSunBold,
  PiTerminalWindow,
  PiTerminalWindowBold,
  PiTrashBold,
  PiTrendUpBold,
  PiUploadBold,
  PiUser,
  PiUserBold,
  PiUserGear,
  PiUserGearBold,
  PiUserPlus,
  PiUserPlusBold,
  PiUsersBold,
  PiWarningBold,
  PiWarningCircleBold,
  PiWaveformBold,
  PiXBold,
} from "react-icons/pi";
import {
  TbBrandChrome,
  TbGripVertical,
  TbMenu2,
  TbSchool,
} from "react-icons/tb";

import {
  LuActivity,
  LuArrowDown,
  LuArrowLeft,
  LuArrowRight,
  LuArrowUp,
  LuBadgeCheck,
  LuBell,
  LuCalendar,
  LuChevronDown,
  LuChevronUp,
  LuCircleAlert,
  LuCircleCheck,
  LuCircleCheckBig,
  LuClipboardList,
  LuClock,
  LuCopy,
  LuDownload,
  LuExternalLink,
  LuEye,
  LuEyeOff,
  LuFileQuestion,
  LuFileText,
  LuGlobe,
  LuGrid3X3,
  LuGripVertical,
  LuGuitar,
  LuHouse,
  LuIdCard,
  LuImage,
  LuInfo,
  LuLayers3,
  LuLibraryBig,
  LuLightbulb,
  LuLink,
  LuLink2,
  LuList,
  LuListChecks,
  LuLoaderCircle,
  LuLock,
  LuLockOpen,
  LuLogOut,
  LuMapPin,
  LuMenu,
  LuMessageCircle,
  LuMessageSquare,
  LuMic,
  LuMonitor,
  LuMoonStar,
  LuMusic,
  LuNotebookPen,
  LuPackage,
  LuPause,
  LuPencil,
  LuPencilLine,
  LuPhone,
  LuPin,
  LuPlay,
  LuPlus,
  LuPower,
  LuPrinter,
  LuRedo2,
  LuRefreshCw,
  LuRotateCcw,
  LuSave,
  LuSchool,
  LuSearch,
  LuSend,
  LuSettings,
  LuShield,
  LuShieldAlert,
  LuSlidersHorizontal,
  LuSunMedium,
  LuSwitchCamera,
  LuTerminal,
  LuTrash2,
  LuTrendingUp,
  LuTriangleAlert,
  LuUndo2,
  LuUpload,
  LuUser,
  LuUserCog,
  LuUserPlus,
  LuUsers,
  LuVolume2,
  LuX,
  LuZoomIn,
  LuZoomOut,
} from "react-icons/lu";
import {
  RxActivityLog,
  RxArrowDown,
  RxArrowLeft,
  RxArrowRight,
  RxArrowUp,
  RxBarChart,
  RxBell,
  RxCalendar,
  RxChatBubble,
  RxCheckCircled,
  RxChevronDown,
  RxChevronUp,
  RxClipboard,
  RxClock,
  RxCopy,
  RxCounterClockwiseClock,
  RxCross2,
  RxCube,
  RxDesktop,
  RxDownload,
  RxDragHandleDots2,
  RxDrawingPin,
  RxExclamationCircled,
  RxExclamationTriangle,
  RxExit,
  RxExternalLink,
  RxEyeClosed,
  RxEyeOpen,
  RxFileText,
  RxGear,
  RxGlobe2,
  RxGrid,
  RxHamburgerMenu,
  RxHome,
  RxIdCard,
  RxImage,
  RxInfoCircled,
  RxLayers,
  RxLink1,
  RxLink2,
  RxListBullet,
  RxLockClosed,
  RxLockOpen2,
  RxLoop,
  RxMagnifyingGlass,
  RxMixerHorizontal,
  RxMoon,
  RxPaperPlane,
  RxPause,
  RxPencil1,
  RxPencil2,
  RxPeople,
  RxPlay,
  RxPlus,
  RxQuestionMarkCircled,
  RxReload,
  RxReset,
  RxSpeakerLoud,
  RxSun,
  RxTrash,
  RxUpdate,
  RxUpload,
  RxZoomIn,
  RxZoomOut,
} from "react-icons/rx";
import {
  MdAdd,
  MdArrowBack,
  MdArrowDownward,
  MdArrowForward,
  MdArrowUpward,
  MdAssignment,
  MdAutorenew,
  MdBadge,
  MdCalendarMonth,
  MdCameraswitch,
  MdChat,
  MdChatBubble,
  MdCheckCircle,
  MdChecklist,
  MdClose,
  MdContentCopy,
  MdDarkMode,
  MdDelete,
  MdDescription,
  MdDownload,
  MdDragIndicator,
  MdEdit,
  MdEditNote,
  MdErrorOutline,
  MdExpandLess,
  MdExpandMore,
  MdFindInPage,
  MdGppMaybe,
  MdGraphicEq,
  MdGridOn,
  MdGroups,
  MdHome,
  MdImage,
  MdInfo,
  MdInsertLink,
  MdInventory2,
  MdLayers,
  MdLibraryBooks,
  MdLightMode,
  MdLightbulb,
  MdLink,
  MdList,
  MdLock,
  MdLockOpen,
  MdLogout,
  MdManageAccounts,
  MdMenu,
  MdMic,
  MdMonitor,
  MdMusicNote,
  MdNotifications,
  MdOpenInNew,
  MdPause,
  MdPerson,
  MdPersonAdd,
  MdPhone,
  MdPlace,
  MdPlayArrow,
  MdPowerSettingsNew,
  MdPrint,
  MdPublic,
  MdPushPin,
  MdRedo,
  MdRefresh,
  MdRotateLeft,
  MdSave,
  MdSchedule,
  MdSchool,
  MdSearch,
  MdSend,
  MdSettings,
  MdShield,
  MdTerminal,
  MdTrendingUp,
  MdTune,
  MdUndo,
  MdUpload,
  MdVerified,
  MdVisibility,
  MdVisibilityOff,
  MdVolumeUp,
  MdWarningAmber,
  MdZoomIn,
  MdZoomOut,
} from "react-icons/md";

export type LucideIcon = IconType;

type IconVariants = { original: IconType; shadcn: IconType; radix: IconType; material: IconType };

function presetIcon(variants: IconVariants): IconType {
  return function PresetIcon(props) {
    const preset = useContext(DesignContext)?.preset ?? "original";
    const Icon = variants[preset];
    return <Icon {...props} data-icon-family={preset} />;
  };
}

export const Activity = presetIcon({ original: PiWaveformBold, shadcn: LuActivity, radix: RxActivityLog, material: MdGraphicEq });
export const AlertCircle = presetIcon({ original: PiWarningCircleBold, shadcn: LuCircleAlert, radix: RxExclamationCircled, material: MdErrorOutline });
export const AlertTriangle = presetIcon({ original: PiWarningBold, shadcn: LuTriangleAlert, radix: RxExclamationTriangle, material: MdWarningAmber });
export const ArrowDown = presetIcon({ original: PiArrowDownBold, shadcn: LuArrowDown, radix: RxArrowDown, material: MdArrowDownward });
export const ArrowLeft = presetIcon({ original: PiArrowLeftBold, shadcn: LuArrowLeft, radix: RxArrowLeft, material: MdArrowBack });
export const ArrowRight = presetIcon({ original: PiArrowRightBold, shadcn: LuArrowRight, radix: RxArrowRight, material: MdArrowForward });
export const ArrowUp = presetIcon({ original: PiArrowUpBold, shadcn: LuArrowUp, radix: RxArrowUp, material: MdArrowUpward });
export const BadgeCheck = presetIcon({ original: PiCheckCircleBold, shadcn: LuBadgeCheck, radix: RxCheckCircled, material: MdVerified });
export const Bell = presetIcon({ original: PiBellBold, shadcn: LuBell, radix: RxBell, material: MdNotifications });
export const Calendar = presetIcon({ original: PiCalendarBold, shadcn: LuCalendar, radix: RxCalendar, material: MdCalendarMonth });
export const CheckCircle = presetIcon({ original: PiCheckCircleBold, shadcn: LuCircleCheck, radix: RxCheckCircled, material: MdCheckCircle });
export const CheckCircle2 = presetIcon({ original: PiCheckCircleFill, shadcn: LuCircleCheckBig, radix: RxCheckCircled, material: MdCheckCircle });
export const ChevronDown = presetIcon({ original: PiCaretDownBold, shadcn: LuChevronDown, radix: RxChevronDown, material: MdExpandMore });
export const ChevronUp = presetIcon({ original: PiCaretUpBold, shadcn: LuChevronUp, radix: RxChevronUp, material: MdExpandLess });
export const Chrome = presetIcon({ original: TbBrandChrome, shadcn: TbBrandChrome, radix: TbBrandChrome, material: TbBrandChrome });
export const ClipboardList = presetIcon({ original: PiClipboardTextBold, shadcn: LuClipboardList, radix: RxClipboard, material: MdAssignment });
export const Clock = presetIcon({ original: PiClockBold, shadcn: LuClock, radix: RxClock, material: MdSchedule });
export const Copy = presetIcon({ original: PiCopyBold, shadcn: LuCopy, radix: RxCopy, material: MdContentCopy });
export const Download = presetIcon({ original: PiDownloadBold, shadcn: LuDownload, radix: RxDownload, material: MdDownload });
export const Edit = presetIcon({ original: PiPencilSimpleBold, shadcn: LuPencil, radix: RxPencil1, material: MdEdit });
export const ExternalLink = presetIcon({ original: PiArrowSquareOutBold, shadcn: LuExternalLink, radix: RxExternalLink, material: MdOpenInNew });
export const Eye = presetIcon({ original: PiEyeBold, shadcn: LuEye, radix: RxEyeOpen, material: MdVisibility });
export const EyeOff = presetIcon({ original: PiEyeSlashBold, shadcn: LuEyeOff, radix: RxEyeClosed, material: MdVisibilityOff });
export const FileQuestion = presetIcon({ original: PiFileMagnifyingGlassBold, shadcn: LuFileQuestion, radix: RxQuestionMarkCircled, material: MdFindInPage });
export const FileText = presetIcon({ original: PiFileTextBold, shadcn: LuFileText, radix: RxFileText, material: MdDescription });
export const Globe2 = presetIcon({ original: PiGlobeBold, shadcn: LuGlobe, radix: RxGlobe2, material: MdPublic });
export const Grid3x3 = presetIcon({ original: PiGridNineBold, shadcn: LuGrid3X3, radix: RxGrid, material: MdGridOn });
export const GripVertical = presetIcon({ original: TbGripVertical, shadcn: LuGripVertical, radix: RxDragHandleDots2, material: MdDragIndicator });
export const Guitar = presetIcon({ original: PiGuitarBold, shadcn: LuGuitar, radix: PiGuitar, material: PiGuitarFill });
export const Home = presetIcon({ original: PiHouseLineBold, shadcn: LuHouse, radix: RxHome, material: MdHome });
export const IdCard = presetIcon({ original: PiIdentificationCardBold, shadcn: LuIdCard, radix: RxIdCard, material: MdBadge });
export const Image = presetIcon({ original: PiImageBold, shadcn: LuImage, radix: RxImage, material: MdImage });
export const ImageIcon = presetIcon({ original: PiImageBold, shadcn: LuImage, radix: RxImage, material: MdImage });
export const Info = presetIcon({ original: PiInfoBold, shadcn: LuInfo, radix: RxInfoCircled, material: MdInfo });
export const Layers3 = presetIcon({ original: PiSelectionAllBold, shadcn: LuLayers3, radix: RxLayers, material: MdLayers });
export const LibraryBig = presetIcon({ original: PiBooksBold, shadcn: LuLibraryBig, radix: PiBooks, material: MdLibraryBooks });
export const Lightbulb = presetIcon({ original: PiLightbulbBold, shadcn: LuLightbulb, radix: PiLightbulb, material: MdLightbulb });
export const Link = presetIcon({ original: PiLinkBold, shadcn: LuLink, radix: RxLink1, material: MdLink });
export const Link2 = presetIcon({ original: PiLinkSimpleHorizontalBold, shadcn: LuLink2, radix: RxLink2, material: MdInsertLink });
export const List = presetIcon({ original: PiListBold, shadcn: LuList, radix: RxListBullet, material: MdList });
export const ListChecks = presetIcon({ original: PiListChecksBold, shadcn: LuListChecks, radix: PiListChecks, material: MdChecklist });
export const Loader2 = presetIcon({ original: PiCircleNotchBold, shadcn: LuLoaderCircle, radix: RxUpdate, material: MdAutorenew });
export const Lock = presetIcon({ original: PiLockBold, shadcn: LuLock, radix: RxLockClosed, material: MdLock });
export const LockOpen = presetIcon({ original: PiLockOpenBold, shadcn: LuLockOpen, radix: RxLockOpen2, material: MdLockOpen });
export const LogOut = presetIcon({ original: PiSignOutBold, shadcn: LuLogOut, radix: RxExit, material: MdLogout });
export const MapPin = presetIcon({ original: PiMapPinBold, shadcn: LuMapPin, radix: PiMapPin, material: MdPlace });
export const Menu = presetIcon({ original: TbMenu2, shadcn: LuMenu, radix: RxHamburgerMenu, material: MdMenu });
export const MessageCircle = presetIcon({ original: PiChatCircleBold, shadcn: LuMessageCircle, radix: RxChatBubble, material: MdChatBubble });
export const MessageSquare = presetIcon({ original: PiChatTextBold, shadcn: LuMessageSquare, radix: RxChatBubble, material: MdChat });
export const Mic = presetIcon({ original: PiMicrophoneBold, shadcn: LuMic, radix: PiMicrophone, material: MdMic });
export const Monitor = presetIcon({ original: PiMonitorBold, shadcn: LuMonitor, radix: RxDesktop, material: MdMonitor });
export const MoonStar = presetIcon({ original: PiMoonStarsBold, shadcn: LuMoonStar, radix: RxMoon, material: MdDarkMode });
export const Music = presetIcon({ original: PiMusicNotesBold, shadcn: LuMusic, radix: PiMusicNotes, material: MdMusicNote });
export const NotebookPen = presetIcon({ original: PiNotePencilBold, shadcn: LuNotebookPen, radix: PiNotePencil, material: MdEditNote });
export const Package = presetIcon({ original: PiPackageBold, shadcn: LuPackage, radix: RxCube, material: MdInventory2 });
export const Palette = presetIcon({ original: PiPaletteBold, shadcn: LuPalette, radix: RxColorWheel, material: MdPalette });
export const Pause = presetIcon({ original: PiPauseBold, shadcn: LuPause, radix: RxPause, material: MdPause });
export const PencilLine = presetIcon({ original: PiPencilLineBold, shadcn: LuPencilLine, radix: RxPencil2, material: MdEdit });
export const Phone = presetIcon({ original: PiPhoneBold, shadcn: LuPhone, radix: PiPhone, material: MdPhone });
export const Pin = presetIcon({ original: PiPushPinBold, shadcn: LuPin, radix: RxDrawingPin, material: MdPushPin });
export const Play = presetIcon({ original: PiPlayBold, shadcn: LuPlay, radix: RxPlay, material: MdPlayArrow });
export const Plus = presetIcon({ original: PiPlusBold, shadcn: LuPlus, radix: RxPlus, material: MdAdd });
export const Power = presetIcon({ original: PiPowerBold, shadcn: LuPower, radix: PiPower, material: MdPowerSettingsNew });
export const Printer = presetIcon({ original: PiPrinterBold, shadcn: LuPrinter, radix: PiPrinter, material: MdPrint });
export const Redo2 = presetIcon({ original: PiArrowClockwiseBold, shadcn: LuRedo2, radix: RxReload, material: MdRedo });
export const RefreshCw = presetIcon({ original: PiArrowsClockwiseBold, shadcn: LuRefreshCw, radix: RxLoop, material: MdRefresh });
export const RotateCcw = presetIcon({ original: PiArrowCounterClockwiseBold, shadcn: LuRotateCcw, radix: RxCounterClockwiseClock, material: MdRotateLeft });
export const Save = presetIcon({ original: PiFloppyDiskBold, shadcn: LuSave, radix: PiFloppyDisk, material: MdSave });
export const School = presetIcon({ original: TbSchool, shadcn: LuSchool, radix: PiGraduationCap, material: MdSchool });
export const Search = presetIcon({ original: PiMagnifyingGlassBold, shadcn: LuSearch, radix: RxMagnifyingGlass, material: MdSearch });
export const Send = presetIcon({ original: PiPaperPlaneTiltBold, shadcn: LuSend, radix: RxPaperPlane, material: MdSend });
export const Settings = presetIcon({ original: PiGearBold, shadcn: LuSettings, radix: RxGear, material: MdSettings });
export const Shield = presetIcon({ original: PiShieldBold, shadcn: LuShield, radix: PiShield, material: MdShield });
export const ShieldAlert = presetIcon({ original: PiShieldWarningBold, shadcn: LuShieldAlert, radix: PiShieldWarning, material: MdGppMaybe });
export const SlidersHorizontal = presetIcon({ original: PiSlidersHorizontalBold, shadcn: LuSlidersHorizontal, radix: RxMixerHorizontal, material: MdTune });
export const SunMedium = presetIcon({ original: PiSunBold, shadcn: LuSunMedium, radix: RxSun, material: MdLightMode });
export const SwitchCamera = presetIcon({ original: PiCameraRotateBold, shadcn: LuSwitchCamera, radix: PiCameraRotate, material: MdCameraswitch });
export const Terminal = presetIcon({ original: PiTerminalWindowBold, shadcn: LuTerminal, radix: PiTerminalWindow, material: MdTerminal });
export const Trash2 = presetIcon({ original: PiTrashBold, shadcn: LuTrash2, radix: RxTrash, material: MdDelete });
export const TrendingUp = presetIcon({ original: PiTrendUpBold, shadcn: LuTrendingUp, radix: RxBarChart, material: MdTrendingUp });
export const Undo2 = presetIcon({ original: PiArrowCounterClockwiseBold, shadcn: LuUndo2, radix: RxReset, material: MdUndo });
export const Unlock = presetIcon({ original: PiLockOpenBold, shadcn: LuLockOpen, radix: RxLockOpen2, material: MdLockOpen });
export const Upload = presetIcon({ original: PiUploadBold, shadcn: LuUpload, radix: RxUpload, material: MdUpload });
export const User = presetIcon({ original: PiUserBold, shadcn: LuUser, radix: PiUser, material: MdPerson });
export const UserCog = presetIcon({ original: PiUserGearBold, shadcn: LuUserCog, radix: PiUserGear, material: MdManageAccounts });
export const UserPlus = presetIcon({ original: PiUserPlusBold, shadcn: LuUserPlus, radix: PiUserPlus, material: MdPersonAdd });
export const Users = presetIcon({ original: PiUsersBold, shadcn: LuUsers, radix: RxPeople, material: MdGroups });
export const Volume2 = presetIcon({ original: PiSpeakerHighBold, shadcn: LuVolume2, radix: RxSpeakerLoud, material: MdVolumeUp });
export const X = presetIcon({ original: PiXBold, shadcn: LuX, radix: RxCross2, material: MdClose });
export const ZoomIn = presetIcon({ original: PiMagnifyingGlassPlusBold, shadcn: LuZoomIn, radix: RxZoomIn, material: MdZoomIn });
export const ZoomOut = presetIcon({ original: PiMagnifyingGlassMinusBold, shadcn: LuZoomOut, radix: RxZoomOut, material: MdZoomOut });
